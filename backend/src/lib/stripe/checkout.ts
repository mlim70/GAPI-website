// backend/src/lib/stripe/checkout.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { stripe } from './client';
import User from '../../models/user.model';
import MembershipLevel from '../../models/membershipLevel.model';
import CheckoutSession from '../../models/checkoutSession.model';
import Subscription from '../../models/subscription.model';
import Order from '../../models/order.model';
import { connectToDatabase } from '../../utils/database/db';
import { getFrontendUrl } from '../../config/urls';

import { fixedWindowLimiter, ipId } from '../../middleware/limit';
import { addSecurityHeaders, generateVerifyNonce } from '../../middleware/security';
import { JWT_SECRET } from '../../config/env';
import { logger } from '../../utils/general/logger';
import { normalizeEmail } from '../../utils/email/emailUtils';
import { getCachedStripePriceAndProduct } from '../../utils/stripe/cachedRetrieval';
import { ensureStripeCustomer } from '../../utils/stripe/stripeCustomer';
import { safeActivateUser } from '../../utils/accounts/duplicateEmailHandler';
import { recomputeUserMembershipLevel, recomputeUserAccountStatus } from '../../services/subscriptions';
import { sendWelcomeEmail } from '../../utils/email/email';

const router = Router();

// Apply security headers to all checkout routes
router.use(addSecurityHeaders);

// Rate limiting for cleanup function
let lastCleanup = 0;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up expired checkout sessions
 */
async function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  try {
    const result = await CheckoutSession.updateMany(
      { 
        status: 'CREATED', 
        expiresAt: { $lt: new Date() } 
      },
      { $set: { status: 'EXPIRED' } }
    );
    
    if (result.modifiedCount > 0) {
      logger.info(`🧹 Cleaned up ${result.modifiedCount} expired checkout sessions`);
    }
    lastCleanup = now;
  } catch (error) {
    logger.error('❌ Failed to cleanup expired sessions', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Start checkout route - handles deduplication and session creation
router.post('/start', 
  fixedWindowLimiter({
    windowMs: 15 * 60_000,
    max: 50,
    prefix: "rl:checkout-start",
    idFn: ipId,
    routeKey: () => "/api/stripe/checkout/start",
  }),
  async (req, res) => {
  try {
    await connectToDatabase();
    
    // Clean up expired sessions before processing new requests
    await cleanupExpiredSessions();
    
    logger.info('🚀 Starting checkout process...');
    
    const { levelKey } = req.body;
    if (!levelKey) {
      return res.status(400).json({ message: 'levelKey is required' });
    }

    // Handle both authenticated and unauthenticated users
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    let user;
    
    if (token) {
      // Authenticated user flow
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const authedUserId = decoded.id;
        
        // Check if user account exists and is verified
        user = await User.findById(authedUserId);
        if (!user || user.status !== 'ACTIVE') {
          logger.warn('❌ User not found or account not verified:', { userId: authedUserId, status: user?.status });
          return res.status(404).json({ message: 'Account not found or not verified' });
        }
        logger.debug('✅ Found authenticated user:', { email: user.email, username: user.username });
      } catch (jwtError) {
        logger.warn('❌ Invalid JWT token:', jwtError);
        return res.status(401).json({ message: 'Invalid authentication token' });
      }
    } else {
      // Unauthenticated user flow (from email verification)
      const { email, firstName, lastName } = req.body;
      
      if (!email || !firstName || !lastName) {
        logger.warn('❌ Missing required fields for unauthenticated checkout');
        return res.status(400).json({ message: 'Email, firstName, and lastName are required for unauthenticated checkout' });
      }
      
      // Use proper email normalization instead of ad-hoc toLowerCase()
      const normalizedEmail = normalizeEmail(email);
      
      // Find user by normalized email
      user = await User.findOne({
        email: normalizedEmail,
        status: 'VERIFIED_PENDING_PAYMENT',
      }).sort({ createdAt: -1 });
      if (!user) {
        logger.warn('❌ User not found or not in VERIFIED_PENDING_PAYMENT status:', { email: normalizedEmail });
        return res.status(404).json({ message: 'Account not found or not ready for checkout' });
      }
      
      // Update user with the provided name if not already set
      if (!user.name?.first || !user.name?.last) {
        user.name = {
          first: firstName.trim(),
          last: lastName.trim()
        };
        await user.save();
        logger.info('✅ Updated user name from checkout data:', { userId: user._id, name: user.name });
      }
      
      logger.debug('✅ Found unauthenticated user for checkout:', { email: user.email, username: user.username, name: user.name });
    }

    // Validate membership level first
    const level = await MembershipLevel.findOne({ key: levelKey, status: 'ACTIVE' });
    if (!level) {
      logger.warn('❌ Invalid or archived membership level:', { levelKey });
      return res.status(400).json({ message: 'Invalid levelKey or membership level is not available' });
    }

    // Only check for active subscriptions if user is already ACTIVE
    if (user.status === 'ACTIVE') {
      const activeSubscription = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' });
      
      if (activeSubscription) {
        // Get the current membership level details
        const currentLevel = await MembershipLevel.findById(activeSubscription.levelId);
        
        // Allow checkout if:
        // 1. User is switching from recurring to one-time (lifetime)
        // 2. User is switching to a different subscription tier
        // 3. User is upgrading/downgrading their plan
        if (currentLevel && level) {
          const isSwitchingToLifetime = activeSubscription.kind === 'RECURRING' && !level.isRecurring;
          const isDifferentTier = currentLevel.key !== level.key;
          
          if (isSwitchingToLifetime) {
            logger.info('✅ Allowing subscription to lifetime switch:', {
              from: currentLevel.key,
              to: level.key,
              fromKind: activeSubscription.kind,
              toKind: level.isRecurring ? 'RECURRING' : 'ONE_TIME',
              reason: 'switching to lifetime'
            });
            
            logger.debug('🔄 User switching from subscription to lifetime - will cancel existing sub after payment');
          } else if (isDifferentTier && level.isRecurring) {
            // Block subscription-to-subscription changes - these should use billing portal
            return res.status(400).json({
              message: 'To change your subscription plan, please use the billing portal to manage your membership.',
            });
          } else {
            // Block if trying to create duplicate of same type
            return res.status(400).json({
              message: 'You already have an active membership at this level. Use the billing portal to manage it.',
            });
          }
        } else {
          // Fallback: block if we can't determine the levels
          return res.status(400).json({
            message: 'You already have an active membership. Use the billing portal to manage it.',
          });
        }
      }
    } else {
      logger.debug('✅ User status is not ACTIVE, skipping subscription checks:', { 
        userId: user._id, 
        status: user.status 
      });
    }

    // Validate stripePriceId exists and is not empty
    if (!level.stripePriceId || level.stripePriceId.trim() === '') {
      logger.error('❌ Membership level has no stripePriceId:', { levelKey, levelId: level._id });
      return res.status(400).json({ message: 'Membership level is not properly configured' });
    }

    logger.debug('💳 Creating session for price ID:', level.stripePriceId);

    // Validate stripePriceId format
    if (!level.stripePriceId.startsWith('price_')) {
      logger.error('❌ Invalid stripePriceId format:', level.stripePriceId);
      return res.status(400).json({ message: 'Invalid price configuration' });
    }

    // Validate that the Stripe price exists and is active (with caching)
    const { price, product } = await getCachedStripePriceAndProduct(level.stripePriceId);
    
    // After: const { price, product } = await getCachedStripePriceAndProduct(level.stripePriceId);
    const unit = price.unit_amount ?? 0;

    // $0 + non-recurring (e.g., free lifetime/student) → bypass Stripe
    if (!level.isRecurring && unit === 0) {
      // 1) Resolve user
      // 2) Upsert ONE_TIME Subscription
      const subscription = await Subscription.findOneAndUpdate(
        { userId: user._id, kind: 'ONE_TIME', gateway: 'internal' }, // gateway: 'internal' as opposed to 'stripe'
        {
          $set: {
            levelId: level._id,
            planName: level.key,
            status: 'ACTIVE',
            startDate: new Date(),
            autoRenews: false,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      // 3) Create a $0 Order (idempotent)
      const freeOrderData: any = {
        userId: user._id,
        subscriptionId: subscription._id,
        membershipLevelId: level._id,
        totalCents: 0,
        currency: (level.currency || 'usd').toLowerCase(),
        billing: {
          name: user?.name?.first && user?.name?.last ? `${user.name.first} ${user.name.last}` : 'Customer',
          email: user.email,
        },
        status: 'COMPLETED',
        paidAt: new Date(),
        // gatewayPaymentId will be added via spread in $setOnInsert
        // gatewayInvoiceId is intentionally omitted - don't set null values
      };
      
      const freePaymentId = `free:${String(user._id)}:${level.key}`;
      await Order.updateOne(
        { gatewayPaymentId: freePaymentId }, // stable synthetic id for idempotency
        { $setOnInsert: { ...freeOrderData, gatewayPaymentId: freePaymentId } },
        { upsert: true, runValidators: true }
      );

      // 4) Handle "upgrade" from recurring → lifetime (mirrors your PI succeeded logic)
      const existingRecurringSub = await Subscription.findOne({ userId: user._id, kind: 'RECURRING', status: 'ACTIVE' });
      if (existingRecurringSub?.stripeSubscriptionId) {
        try {
          const updated = await stripe.subscriptions.update(
            existingRecurringSub.stripeSubscriptionId,
            {
              cancel_at_period_end: true,
              metadata: {
                superseded_by: String(subscription._id),
                superseded_at: new Date().toISOString(),
              },
            },
            { idempotencyKey: `sub:cancelAtEnd:${existingRecurringSub.stripeSubscriptionId}` }
          );

          await Subscription.updateOne(
            { _id: existingRecurringSub._id },
            {
              $set: {
                status: 'SUPERSEDED',
                cancelReason: 'Superseded by lifetime membership (free path)',
                supersededBy: subscription._id,
                supersededAt: new Date(),
                nextBillDate: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
                stripeStatus: updated.status,
              }
            },
            { runValidators: true }
          );
        } catch (e) {
          logger.error('Failed to schedule cancel_at_period_end for free lifetime upgrade', e);
        }
      } else if (existingRecurringSub) {
        await Subscription.updateOne(
          { _id: existingRecurringSub._id },
          {
            $set: {
              status: 'SUPERSEDED',
              cancelReason: 'Superseded by lifetime membership - no Stripe subscription to cancel',
              supersededBy: subscription._id,
              supersededAt: new Date(),
            }
          },
          { runValidators: true }
        );
      }

      // 5) Activate user + recompute caches (same helpers you already use)
      const u = await User.findById(user._id).select('status').lean();
      if (u && u.status !== 'DELETED' && u.status !== 'REFUNDED') {
        await safeActivateUser(user._id);
      }
      try {
        await recomputeUserMembershipLevel(user._id);
        await recomputeUserAccountStatus(user._id);
      } catch (e) {
        logger.warn('Recompute after free checkout failed (continuing)', e);
      }

      // 6) (Optional) Send welcome email
      try {
        await sendWelcomeEmail(user.email, `${user.name?.first ?? ''} ${user.name?.last ?? ''}`.trim() || 'Member');
      } catch (e) {
        logger.warn('Welcome email (free path) failed', e);
      }

      // 7) Return auth + redirect info directly (no Stripe redirect, no verify-session)
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        completed: true,
        token,
        user: await User.findById(user._id).select('-passwordHash').lean(),
        redirectUrl: `${getFrontendUrl()}/stripe/success?free=1`
      });
    }
    
    if (!price.active) {
      logger.error('❌ Stripe price is inactive:', level.stripePriceId);
      return res.status(400).json({ message: 'Selected membership level is not available' });
    }
    
    // Validate that the associated product is also active
    // Stripe can mark products inactive while leaving prices around
    if (!product.active) {
      logger.error('❌ Stripe product is inactive:', { productId: product.id, priceId: level.stripePriceId });
      return res.status(400).json({ message: 'Selected membership product is not available' });
    }
    
    // Validate currency matches
    if (price.currency.toLowerCase() !== level.currency.toLowerCase()) {
      logger.warn('❌ Currency mismatch:', {
        expected: level.currency,
        actual: price.currency,
        levelKey
      });
      return res.status(400).json({ message: 'Price configuration mismatch' });
    }
    
    // Validate interval for recurring plans
    if (level.isRecurring && price.recurring?.interval !== level.interval) {
      logger.warn('❌ Interval mismatch for recurring plan:', {
        expected: level.interval,
        actual: price.recurring?.interval,
        levelKey
      });
      return res.status(400).json({ message: 'Price configuration mismatch' });
    }

    // Check for existing active checkout session for this user/level
    const existingSession = await CheckoutSession.findOne({
      userId: user._id,
      levelKey,
      status: 'CREATED',
      expiresAt: { $gt: new Date() }
    });

    if (existingSession) {
      logger.debug('🔄 Found existing active checkout session, reusing:', {
        sessionId: existingSession.stripeSessionId,
        createdAt: existingSession.createdAt,
        expiresAt: existingSession.expiresAt
      });

      // Verify the session still exists in Stripe and is valid
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(existingSession.stripeSessionId);
        
        if (stripeSession.status === 'open' && stripeSession.payment_status === 'unpaid') {
          logger.info('✅ Existing Stripe session is still valid, reusing');
          return res.status(200).json({
            sessionUrl: stripeSession.url,
            sessionId: stripeSession.id,
            verifyNonce: existingSession.verifyNonce, // Use existing nonce
            reused: true
          });
        } else {
          logger.warn('⚠️ Existing Stripe session is no longer valid, will create new one');
          // Mark the old session as expired
          try {
            await CheckoutSession.updateOne(
              { _id: existingSession._id },
              { $set: { status: 'EXPIRED' } },
              { runValidators: true }
            );
          } catch (e) {
            logger.error('❌ Failed to mark CheckoutSession EXPIRED (validity branch)', {
              id: String(existingSession._id),
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }
      } catch (stripeError) {
        logger.warn('⚠️ Could not retrieve existing Stripe session, will create new one', {
          message: (stripeError as any)?.message,
        });
        // Mark the old session as expired
        try {
          await CheckoutSession.updateOne(
            { _id: existingSession._id },
            { $set: { status: 'EXPIRED' } },
            { runValidators: true }
          );
        } catch (e) {
          logger.error('❌ Failed to mark CheckoutSession EXPIRED (catch branch)', {
            id: String(existingSession._id),
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Always ensure Stripe customer from the real user
    const customerId = await ensureStripeCustomer(user);

    // Generate nonce before creating Stripe session so we can include it in success_url
    const verifyNonce = generateVerifyNonce();
    
    // Generate idempotency key to prevent duplicate sessions on retries
    // Include verifyNonce to prevent conflicts when request body changes
    const idemKey = `cs:create:${user._id}:${level.stripePriceId}:${customerId}:${verifyNonce}`;
    
    const session = await stripe.checkout.sessions.create({
      mode: level.isRecurring ? 'subscription' : 'payment',
      customer: customerId,
      client_reference_id: user._id.toString(),
      line_items: [{ price: level.stripePriceId, quantity: 1 }],
      metadata: { 
        userId: user._id.toString(), 
        levelKey,
        customerName: user.name?.first && user.name?.last ? `${user.name.first} ${user.name.last}` : undefined
      },
      ...(level.isRecurring
        ? {
            subscription_data: {
              metadata: { 
                userId: user._id.toString(), 
                levelKey,
                customerName: user.name?.first && user.name?.last ? `${user.name.first} ${user.name.last}` : undefined
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: { 
                userId: user._id.toString(), 
                levelKey,
                customerName: user.name?.first && user.name?.last ? `${user.name.first} ${user.name.last}` : undefined
              },
            },
          }),
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      success_url: `${getFrontendUrl()}/stripe/success?session_id={CHECKOUT_SESSION_ID}&nonce=${verifyNonce}`,
      cancel_url: `${getFrontendUrl()}/stripe/cancel`,
    }, { idempotencyKey: idemKey });
    
    logger.info('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

    // Create checkout session record with all required fields and proper TTL
    logger.debug('📝 Creating checkout session record...');
    
    if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
      try {
        
        await CheckoutSession.create({
          userId: user._id,
          stripeSessionId: session.id,
          mode: session.mode,
          levelKey,
          levelId: level._id,
          priceId: level.stripePriceId,
          stripeCustomerId: customerId,
          status: 'CREATED',
          verifyNonce,
          // Prefer Stripe's actual expiry:
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000) 
                                        : new Date(Date.now() + 24*60*60*1000),
        });
        logger.info('✅ Created checkout session record with nonce:', verifyNonce);
      } catch (dbError: any) {
        // Handle duplicate key error (race condition)
        if (dbError.code === 11000 && dbError.keyPattern?.userId && dbError.keyPattern?.levelKey && dbError.keyPattern?.status) {
          logger.warn('⚠️ Duplicate checkout session detected (race condition), cleaning up Stripe session');
          
          // Clean up the Stripe session we just created
          try {
            await stripe.checkout.sessions.expire(session.id);
            logger.info('✅ Expired duplicate Stripe session:', session.id);
          } catch (stripeError) {
            logger.warn('⚠️ Failed to expire duplicate Stripe session:', stripeError);
          }
          
          // Return error indicating duplicate session
          return res.status(409).json({ 
            message: 'A checkout session is already in progress. Please complete or cancel the existing session first.',
            code: 'DUPLICATE_SESSION'
          });
        }
        
        // Re-throw other database errors
        throw dbError;
      }
    } else {
      logger.warn('⚠️ Invalid Stripe session ID format, skipping record creation:', session.id);
    }

    logger.info('🎉 Checkout session creation successful');
    return res.status(200).json({
      sessionUrl: session.url,
      sessionId: session.id,
      verifyNonce: verifyNonce, // Include nonce for session verification
    });
    
  } catch (err: any) {
    logger.error('❌ Unhandled error in checkout start route', {
      message: err?.message ?? String(err),
      name: err?.name,
      stack: err?.stack,
    });
    return res.status(500).json({ 
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// Verify session and return user authentication data
// Note: v2 sessions (webhook-driven) are handled differently and don't go through finalization
router.get('/verify-session', async (req, res) => {
  try {
    const { session_id, nonce } = req.query;
    if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return res.status(400).json({ message: 'Bad session_id' });
    }
    if (!nonce || typeof nonce !== 'string') {
      return res.status(400).json({ message: 'Missing nonce' });
    }

    await connectToDatabase();
    logger.debug('🔍 Verifying session:', session_id);
    const doc = await CheckoutSession.findOne({ stripeSessionId: session_id }).lean() as any;
    
    // Verify nonce to prevent unauthorized access
    if (!doc || doc.verifyNonce !== nonce) {
      // Log only IDs for security - no sensitive nonce values
      logger.warn('❌ Nonce verification failed:', { 
        sessionId: session_id, 
        docId: doc?._id ? String(doc._id) : 'not_found',
        docExists: !!doc 
      });
      return res.status(403).json({ 
        message: 'Verification mismatch',
        error: 'nonce_mismatch'
      });
    }
    
    logger.info('✅ Nonce verification successful');
    logger.debug('📦 CheckoutSession document:', doc ? {
      id: doc._id,
      userId: doc.userId,
      levelKey: doc.levelKey,
      status: doc.status
    } : 'Not found');

    // ✅ Only ready when webhooks flipped it
    if (doc?.ready === true && doc.userId) {
      const user = await User.findById(doc.userId).select('-passwordHash').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(200).json({
          ready: true,
          message: 'Payment received; activating account…',
          flow: 'webhook-only',
          status: user.status,
        });
      }

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        ready: true,
        token,
        user,
        message: 'Payment completed',
        flow: 'webhook-only'
      });
    }
    return res.status(200).json({
      ready: false,
      message: 'Awaiting webhook fulfillment',
      flow: 'webhook-only'
    });
  } catch (e: any) {
    logger.error('verify-session error:', {
      message: e?.message ?? String(e),
      name: e?.name,
      stack: e?.stack,
    });
    res.status(500).json({ message: 'Failed to verify session' });
  }
});


router.get('/payment-status', 
  fixedWindowLimiter({
    windowMs: 60_000,
    max: 60,
    prefix: "rl:payment-status",
    idFn: (req) => {
      // Rate limiting per sessionId for payment status checks
      const sessionId = (req.query.sessionId as string | undefined)?.trim();
      return sessionId ? `session:${sessionId}` : ipId(req);
    },
    routeKey: () => "/api/stripe/checkout/payment-status",
  }),
  async (req, res) => {
  try {
    await connectToDatabase();
    const sessionId = (req.query.sessionId as string | undefined)?.trim();
    if (!sessionId || !/^cs_/.test(sessionId)) {
      return res.status(400).json({ ready: false, message: 'Missing or bad sessionId' });
    }

    const doc = await CheckoutSession
      .findOne({ stripeSessionId: sessionId })
      .select('status ready readyAt userId levelKey stripeSessionId')
      .lean() as any;

    if (!doc) {
      return res.status(200).json({ ready: false, message: 'Processing…' });
    }

    const ready = !!doc.ready;
    return res.status(200).json({
      ready,
      message: ready ? 'Payment complete' : 'Processing…',
      readyAt: doc.readyAt ?? null,
      userId: doc.userId ? String(doc.userId) : null,
      levelKey: doc.levelKey ?? null,
      sessionId: doc.stripeSessionId,
    });
  } catch (e) {
    logger.error('payment-status error:', {
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : undefined,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return res.status(500).json({ ready: false, message: 'Failed to check payment status' });
  }
});

export default router;
