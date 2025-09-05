//backend/src/routes/account.ts
import { Router } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import { IMembershipLevel } from '../models/membershipLevel.model';
import MembershipLevel from '../models/membershipLevel.model';

import { connectToDatabase } from '../utils/database/db';
import { normalizeUsername, isValidUsernameFormat } from '../utils/accounts/usernameUtils';
import { fixedWindowLimiter, userIdId } from '../middleware/limit';
import { stripe } from '../lib/stripe/client';
import { requireAuth } from '../middleware/requireAuth';
import { sendAccountDeletionEmail, sendPasswordChangeEmail } from '../utils/email/email';
import { logger } from '../utils/general/logger';

import { JWT_SECRET } from '../config/env';

const router = Router();

// Get comprehensive account data
router.get('/profile', 
  requireAuth,
  async (req: Request, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.userId;

    // Get user profile
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get active subscription with membership level details
    const subscription = await Subscription.findOne({ 
      userId: userId, 
      status: 'ACTIVE' 
    }).populate<{ levelId: IMembershipLevel }>('levelId');

    res.json({
      profile: {
        _id: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      subscription: subscription && subscription.levelId ? {
        _id: subscription._id.toString(),
        status: subscription.status,
        stripeStatus: subscription.stripeStatus,
        kind: subscription.kind,
        startDate: subscription.startDate.toISOString(),
        nextBillDate: subscription.nextBillDate?.toISOString(),
        cancelDate: subscription.cancelDate?.toISOString(),
        membershipLevel: {
          _id: subscription.levelId._id.toString(),
          key: subscription.levelId.key,
          name: subscription.levelId.key,
          description: subscription.levelId.description,
          unitAmount: subscription.levelId.unitAmount,
          currency: subscription.levelId.currency,
          isRecurring: subscription.levelId.isRecurring,
          interval: subscription.levelId.interval,
          intervalCount: subscription.levelId.intervalCount
        }
      } : null
    });

  } catch (error) {
    logger.error('Error fetching account data:', error);
    res.status(500).json({ message: 'Failed to fetch account data' });
  }
});

// Update user profile
router.put('/profile', 
  requireAuth,
  fixedWindowLimiter({
    windowMs: 15 * 60_000,
    max: 20,
    prefix: "rl:profile-update",
    idFn: userIdId,
    routeKey: () => "/api/account/profile",
  }),
  async (req: Request, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.userId;
    const { username, name } = req.body;

    // Validate input
    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
      }
      if (!isValidUsernameFormat(username)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, hyphens, underscores, periods, and @ symbols, and must start with a letter or number' });
      }
    }

    if (name) {
      if (name.first && (name.first.trim().length < 1 || name.first.trim().length > 50)) {
        return res.status(400).json({ message: 'First name must be between 1 and 50 characters' });
      }
      if (name.last && (name.last.trim().length < 1 || name.last.trim().length > 50)) {
        return res.status(400).json({ message: 'Last name must be between 1 and 50 characters' });
      }
    }

    // Check if username is already taken by active users (if being updated)
    if (username) {
      const normalizedUsername = normalizeUsername(username);
      const existingUser = await User.findOne({ 
        username: normalizedUsername, 
        _id: { $ne: userId },
        status: 'ACTIVE'  // Only check against active users
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Update user
    const updateData: any = {};
    if (username) updateData.username = normalizeUsername(username);
    if (name) {
      updateData.name = {
        first: name.first?.trim(),
        last: name.last?.trim()
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      }
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

/**
 * Delete user account
 * 
 * IMPORTANT: This endpoint ensures proper cleanup by:
 * 1. Scheduling end-of-period cancellation for ALL live Stripe subscriptions (provides value for paid period)
 * 2. Updating database status to CANCELLED
 * 3. Soft-deleting the user account (anonymizes data)
 */
router.delete('/', 
  requireAuth,
  fixedWindowLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    prefix: "rl:account-delete",
    idFn: userIdId,
    routeKey: () => "/api/account/delete",
  }),
  async (req: Request, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    // Get user with password hash for verification
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password before deletion
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Get user's subscription data before deletion for email summary
    const userSubscription = await Subscription.findOne({ userId: userId, status: 'ACTIVE' });

    // 1. Cancel live Stripe subscriptions to prevent continued billing
    const activeSubscriptions = await Subscription.find({ userId: userId, status: 'ACTIVE' });
    for (const sub of activeSubscriptions) {
      if (sub.gateway === 'stripe' && sub.stripeSubscriptionId) {
        try {
          logger.info(`🔄 Cancelling Stripe subscription due to account deletion: ${sub.stripeSubscriptionId}`);
          //await stripe.subscriptions.cancel(sub.stripeSubscriptionId); [IMMEDIATE CANCEL]
          // [cancel at end of period]:
          await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
          logger.info(`✅ Successfully scheduled end-of-period cancellation for Stripe subscription: ${sub.stripeSubscriptionId}`);
        } catch (e) {
          logger.warn(`⚠️ Failed to cancel Stripe subscription ${sub.stripeSubscriptionId}:`, e);
          // Continue with other cancellations - don't fail the account deletion
        }
      }
    }
    
    // 2. Clean up Stripe customer data (scrub PII)
    if (user.stripeCustomerId) {
      try {
        logger.info(`🧹 Cleaning up Stripe customer data: ${user.stripeCustomerId}`);
        
        // Update customer with deleted marker and anonymized data
        await stripe.customers.update(user.stripeCustomerId, {
          email: `deleted+${user._id}@example.invalid`,
          name: 'Deleted User',
          metadata: { deleted_at: new Date().toISOString() },
          invoice_settings: { default_payment_method: null },
        });
        
        // Detach all payment methods (only supported types for paymentMethods.list)
        const types = ['card', 'us_bank_account', 'sepa_debit', 'link']; // Stripe's supported payment method types
        for (const t of types) {
          try {
            const list = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: t as any });
            for (const pm of list.data) {
              await stripe.paymentMethods.detach(pm.id);
              logger.info(`🔒 Detached ${t} payment method: ${pm.id}`);
            }
          } catch (e) {
            logger.warn(`PM detach list failed for type ${t}:`, e);
          }
        }
        
        logger.info(`✅ Successfully cleaned up Stripe customer: ${user.stripeCustomerId}`);
      } catch (e) {
        logger.warn('⚠️ Stripe cleanup failed:', e);
        // Continue with account deletion even if Stripe cleanup fails
      }
    }
    
    // 3. Send account deletion email (non-blocking)
    let emailSent = false;
    try {
      await sendAccountDeletionEmail({
        email: user.email,
        name: `${user.name.first} ${user.name.last}`,

        deletionDate: new Date(),
        preservedData: {
          subscriptionStatus: userSubscription ? userSubscription.status : 'none'
        }
      });
      logger.info('✅ Account deletion email sent to:', user.email);
      emailSent = true;
    } catch (emailError) {
      logger.warn('⚠️ Failed to send account deletion email:', emailError);
      // Continue with account deletion even if email fails
    }

    // 4. Soft delete: Anonymize user data and update status
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const deletedHash = await bcrypt.hash(randomSecret, 12);
    
    const anonymizedData = {
      email: `deleted_${Date.now()}_${user._id}@deleted.com`,
      username: `deleted_${Date.now()}_${user._id}`,
      name: { first: 'Deleted', last: 'User' },
      passwordHash: deletedHash,
      status: 'DELETED',
      deletedAt: new Date(),
      statusReason: 'user_requested_deletion',

    };

    // Update user with anonymized data
    await User.findByIdAndUpdate(userId, anonymizedData);

    // 5. Mark subscriptions as cancelled in database
    // Don't set endDate - let the webhook set it when Stripe actually ends the subscription
    // Note: updateMany cannot use runValidators, but this is intentional for bulk status updates
    await Subscription.updateMany(
      { userId: userId },
      { 
        $set: { 
          status: 'CANCELLED',
          cancelDate: new Date(),
          cancelReason: 'account_deleted' // Specific reason for sticky-cancel guard
        },
        $unset: { endDate: 1, supersededBy: 1, supersededAt: 1 } // clear superseded fields
      }
    );

    // 6. Clear user membership level cache since all subscriptions are cancelled
    await User.updateOne(
      { _id: userId },
      { $unset: { membershipLevel: 1 } }
    );

    // Note: Orders are kept as-is for financial record keeping
    // They will still reference the user ID, but the user data is anonymized

    logger.info(`User account soft-deleted: ${userId}`);

    return res.status(200).json({
      message: 'Account deleted successfully',
      emailSent: emailSent
    });

  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// Change password for authenticated users
router.put('/password', 
  requireAuth,
  fixedWindowLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    prefix: "rl:password-change",
    idFn: userIdId,
    routeKey: () => "/api/account/change-password",
  }),
  async (req: Request, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Get user with password hash for verification
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Check if new password is different from current
    const isNewPasswordSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isNewPasswordSame) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password + mark passwordUpdatedAt so older JWTs are invalid
    await User.findByIdAndUpdate(userId, {
      passwordHash: newPasswordHash,
      passwordUpdatedAt: new Date(),
      updatedAt: new Date()
    });

    logger.info(`✅ Password changed successfully for user: ${userId}`);

    // Send password change notification email (non-blocking)
    let emailSent = false;
    try {
      await sendPasswordChangeEmail({
        email: user.email,
        name: `${user.name.first} ${user.name.last}`.trim(),
        changeTimestamp: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
        location: 'Unknown', // Could be enhanced with IP geolocation service
        userAgent: req.get('User-Agent') || 'Unknown'
      });
      emailSent = true;
      logger.info(`📧 Password change notification email sent to: ${user.email}`);
    } catch (e) {
      logger.warn('⚠️ Failed to send password change notification email:', e);
      // Don't fail the password change if email fails
    }

    // Issue a new JWT so the current device stays signed in
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Password changed successfully',
      emailSent: emailSent,
      token
    });

  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

/**
 * Fix recurring subscription data
 */
router.post('/fix-subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    // Find subscription, prioritizing ACTIVE ones
    const subscription = await Subscription.findOne({ 
      userId,
      status: { $in: ['ACTIVE', 'SUPERSEDED'] }
    }).sort({ status: 1, createdAt: -1 });
    if (!subscription) {
      return res.status(404).json({ message: 'No subscription found' });
    }
    
    if (!subscription.stripeSubscriptionId) {
      return res.status(400).json({ message: 'Subscription has no Stripe ID' });
    }
    
    // Fetch latest data from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    // Update the subscription with correct data
    const updateData: any = {
      kind: 'RECURRING',
      autoRenews: !stripeSub.cancel_at_period_end
    };
    
    if (stripeSub.current_period_end) {
      updateData.nextBillDate = new Date(stripeSub.current_period_end * 1000);
    }
    
    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: updateData },
      { runValidators: true }
    );
    
    logger.info('Subscription fixed for user:', { userId, updates: updateData });
    
    res.json({ 
      message: 'Subscription fixed successfully',
      updates: updateData
    });
    
  } catch (error) {
    logger.error('Fix subscription error:', error);
    res.status(500).json({ error: 'Failed to fix subscription' });
  }
});

export default router; 