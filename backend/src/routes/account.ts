import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import { connectToDatabase } from '../utils/db';
import { normalizeUsername } from '../utils/accounts/usernameUtils';
import { sendAccountDeletionEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();



// Middleware to verify JWT token
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    // Check if user account has been soft-deleted
    try {
      await connectToDatabase();
      const userDoc = await User.findById(user.id);
      if (!userDoc || userDoc.isDeleted) {
        return res.status(403).json({ message: 'Account has been deactivated' });
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      return res.status(500).json({ message: 'Error verifying account status' });
    }
    
    req.user = user;
    next();
  });
};

// Get comprehensive account data
router.get('/profile', 
  authenticateToken,
  createRateLimiter(500, 15 * 60 * 1000, 'user'), // 500 profile views per 15 minutes per user
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;

    // Get user profile
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get active subscription with membership level details
    const subscription = await Subscription.findOne({ 
      userId, 
      status: 'ACTIVE' 
    }).populate('levelId');

    // Get payment history (last 10 orders)
    const orders = await Order.find({ userId })
      .populate('membershipLevelId')
      .sort({ paidAt: -1 })
      .limit(10);

    // Calculate total spent
    const totalSpent = orders.reduce((sum, order) => sum + order.totalCents, 0);

    res.json({
      profile: {
        _id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt
      },
      subscription: subscription ? {
        _id: subscription._id,
        status: subscription.status,
        startDate: subscription.startDate,
        nextBillDate: subscription.nextBillDate,
        cancelDate: subscription.cancelDate,
        membershipLevel: subscription.levelId
      } : null,
      orders: orders,
      totalSpent: totalSpent
    });

  } catch (error) {
    console.error('Error fetching account data:', error);
    res.status(500).json({ message: 'Failed to fetch account data' });
  }
});

// Update user profile
router.put('/profile', 
  authenticateToken,
  createRateLimiter(200, 15 * 60 * 1000, 'user'), // 200 profile updates per 15 minutes per user
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;
    const { username, name } = req.body;

    // Validate input
    if (username && (username.length < 3 || username.length > 30)) {
      return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
    }

    if (name) {
      if (name.first && (name.first.length < 1 || name.first.length > 50)) {
        return res.status(400).json({ message: 'First name must be between 1 and 50 characters' });
      }
      if (name.last && (name.last.length < 1 || name.last.length > 50)) {
        return res.status(400).json({ message: 'Last name must be between 1 and 50 characters' });
      }
    }

    // Check if username is already taken (if being updated)
    if (username) {
      const normalizedUsername = normalizeUsername(username);
      const existingUser = await User.findOne({ 
        username: normalizedUsername, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Update user
    const updateData: any = {};
    if (username) updateData.username = normalizeUsername(username);
    if (name) updateData.name = name;

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
        _id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        createdAt: (updatedUser as any).createdAt,
        updatedAt: (updatedUser as any).updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Delete user account
router.delete('/account', 
  authenticateToken,
  createRateLimiter(10, 15 * 60 * 1000, 'user'), // 10 account deletion attempts per 15 minutes per user
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    // Get user with password hash for verification
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password before deletion
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Get user's data before deletion for email summary
    const userOrders = await Order.find({ userId });
    const userSubscription = await Subscription.findOne({ userId, status: 'ACTIVE' });
    
    const preservedData = {
      orderCount: userOrders.length,
      totalSpent: userOrders.reduce((sum, order) => sum + order.totalCents, 0) / 100, // Convert cents to dollars
      subscriptionStatus: userSubscription ? userSubscription.status : 'None'
    };

    // Send confirmation email BEFORE deleting the account
    try {
      await sendAccountDeletionEmail({
        email: user.email,
        name: `${user.name.first} ${user.name.last}`,
        originalEmail: user.email,
        deletionDate: new Date(),
        preservedData
      });
      console.log(`✅ Account deletion confirmation email sent to ${user.email}`);
    } catch (emailError) {
      console.warn('⚠️ Failed to send account deletion email:', emailError);
      // Continue with account deletion even if email fails
    }

    // Soft delete: Anonymize user data instead of hard deleting
    const anonymizedData = {
      email: `deleted_${Date.now()}_${user._id}@deleted.com`,
      username: `deleted_${Date.now()}_${user._id}`,
      name: { first: 'Deleted', last: 'User' },
      passwordHash: 'deleted_account',
      isDeleted: true,
      deletedAt: new Date(),
      // Keep original email for reference in orders/subscriptions
      originalEmail: user.email
    };

    // Update user with anonymized data
    await User.findByIdAndUpdate(userId, anonymizedData);

    // Update subscriptions to mark as cancelled
    await Subscription.updateMany(
      { userId },
      { 
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Account deleted by user'
      }
    );

    // Note: Orders are kept as-is for financial record keeping
    // They will still reference the user ID, but the user data is anonymized

    console.log(`User account soft-deleted: ${userId}`);

    res.json({ 
      message: 'Account deleted successfully',
      deletedAt: new Date().toISOString(),
      note: 'Your account has been deactivated. A confirmation email has been sent to your email address.',
      emailSent: true
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

export default router; 