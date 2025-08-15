import { Router } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import MembershipLevel from '../models/membershipLevel.model';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import jwt from 'jsonwebtoken';
import { getFrontendUrl } from '../config/urls';
import { connectToDatabase } from '../utils/db';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { verifyCheckoutToken, generateIdempotencyKey } from '../utils/accounts/checkoutTokens';
import { finalizeCheckoutFromSession } from '../utils/accounts/finalizeCheckout';
import mongoose, { Types } from 'mongoose';

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();

/**
 * Extract the real client IP address from request, handling proxies/CDNs
 */
function clientIp(req: import('express').Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff)) return xff[0].split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// Helper function to validate Stripe price ID exists
async function validateStripePrice(priceId: string): Promise<boolean> {
  try {
    console.log('🔍 Validating Stripe price ID:', priceId);
    const price = await stripe.prices.retrieve(priceId);
    console.log('✅ Stripe price is valid:', { 
      id: price.id, 
      active: price.active, 
      currency: price.currency,
      unitAmount: price.unit_amount,
      recurring: price.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : 'one-time'
    });
    return price.active;
  } catch (err: any) {
    console.log('❌ Stripe price validation failed:', err.message);
    return false;
  }
}

// Helper function to get the correct base URL
function getBaseUrl(): string {
  const baseUrl = getFrontendUrl();
  
  console.log('🔗 Generated base URL:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    baseUrl
  });
  
  return baseUrl;
}

// Utility function to safely stringify ObjectIds
const asStr = (v: unknown): string =>
  typeof v === 'string' ? v : (v as Types.ObjectId)?.toString?.() ?? '';



router.post('/', 
  createRateLimiter(50, 15 * 60 * 1000, 'custom', (req) => { //TODO
    // Rate limiting per pendingUserId for new users, with higher limits for checkout
    if (req.body.checkoutToken) {
      try {
        const payload = verifyCheckoutToken(req.body.checkoutToken);
        return `pendingUser:${payload.sub}`;
      } catch {
        return `ip:${clientIp(req)}`; // Fallback to IP if token is invalid
      }
    }
    return `ip:${clientIp(req)}`;
  }),
  async (req, res) => {
  try {
    await connectToDatabase();
    
    console.log('🛒 Starting checkout session creation...');
    console.log('🔧 Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL
    });
    
    const { checkoutToken, userId } = req.body;
    console.log('📋 Request body:', { hasCheckoutToken: !!checkoutToken, userId });

    // Handle new-user flow with checkout token
    if (checkoutToken) {
      console.log('👤 Processing new-user flow with checkout token');
      
      try {
        // Verify checkout token
        const payload = verifyCheckoutToken(checkoutToken);
        console.log('✅ Checkout token verified:', { 
          pendingUserId: payload.sub, 
          email: payload.email, 
          levelKey: payload.levelKey 
        });

        // Find the pending user
        const pendingUser = await PendingUser.findById(payload.sub);
        if (!pendingUser) {
          console.log('❌ Pending user not found:', payload.sub);
          return res.status(400).json({ message: 'Pending user not found or expired' });
        }

        // Verify email matches token
        if (pendingUser.email !== payload.email) {
          console.log('❌ Email mismatch:', { 
            tokenEmail: payload.email, 
            pendingUserEmail: pendingUser.email 
          });
          return res.status(400).json({ message: 'Invalid checkout token' });
        }

        // Verify level key matches token
        if (pendingUser.levelKey !== payload.levelKey) {
          console.log('❌ Level key mismatch:', { 
            tokenLevelKey: payload.levelKey, 
            pendingUserLevelKey: pendingUser.levelKey 
          });
          return res.status(400).json({ message: 'Invalid checkout token' });
        }

        console.log('✅ Found pending user:', { email: pendingUser.email, username: pendingUser.username });

        // Check if pending user has expired
        if (pendingUser.expiresAt && pendingUser.expiresAt < new Date()) {
          console.log('❌ Pending user has expired:', { expiresAt: pendingUser.expiresAt, now: new Date() });
          return res.status(400).json({ message: 'Pending user has expired' });
        }
        console.log('✅ Pending user is valid');

        // Check if email is verified before allowing checkout
        if (!pendingUser.emailVerified) {
          console.log('❌ Email not verified for pending user:', { email: pendingUser.email, emailVerified: pendingUser.emailVerified });
          return res
            .status(403)
            .json({ message: 'Please verify your e-mail before proceeding to payment.' });
        }
        console.log('✅ Email verified for pending user');

        // Check for existing active subscription for this email
        const existingUser = await User.findOne({ email: pendingUser.email });
        if (existingUser) {
          const existingSubscription = await Subscription.findOne({ 
            userId: existingUser._id, 
            status: 'ACTIVE' 
          });
          if (existingSubscription) {
            console.log('❌ User already has active subscription:', { email: pendingUser.email });
            return res.status(400).json({ message: 'You already have an active subscription' });
          }
        }

        // look up membership level
        console.log('🔍 Looking up membership level:', payload.levelKey);
        const level = await MembershipLevel.findOne({ key: payload.levelKey });
        if (!level) {
          console.log('❌ Invalid membership level:', payload.levelKey);
          return res.status(400).json({ message: 'Invalid levelKey' });
        }
        console.log('✅ Found membership level:', { 
          id: level._id, 
          key: level.key, 
          priceId: level.stripePriceId,
          isRecurring: level.isRecurring,
          unitAmount: level.unitAmount,
          currency: level.currency
        });

        // Validate stripePriceId exists and is not empty
        if (!level.stripePriceId || level.stripePriceId.trim() === '') {
          console.log('❌ Membership level has no stripePriceId:', { levelKey: payload.levelKey, levelId: level._id });
          return res.status(400).json({ message: 'Membership level is not properly configured' });
        }

        console.log('💳 Creating session for price ID:', level.stripePriceId);

        // Validate stripePriceId format
        if (!level.stripePriceId.startsWith('price_')) {
          console.log('❌ Invalid stripePriceId format:', level.stripePriceId);
          return res.status(400).json({ message: 'Invalid price configuration' });
        }

        // Validate that the Stripe price exists and is active
        const isPriceValid = await validateStripePrice(level.stripePriceId);
        if (!isPriceValid) {
          console.log('❌ Stripe price is invalid or inactive:', level.stripePriceId);
          return res.status(400).json({ message: 'Selected membership level is not available' });
        }

        // Check for existing checkout session with real Stripe ID
        console.log('🔍 Checking for existing checkout session...');
        let needFreshSession = false;
        const existing = await CheckoutSession.findOne({ pendingUserId: pendingUser._id });
        if (existing && existing.stripeSessionId && existing.stripeSessionId.startsWith('cs_')) {
          console.log('🔄 Found existing checkout session:', { id: existing._id, stripeSessionId: existing.stripeSessionId });
          // only if stripeSessionId is an actual Stripe session
          try {
            console.log('🔄 Retrieving existing Stripe session...');
            const stripeSession = await stripe.checkout.sessions.retrieve(existing.stripeSessionId, {
          expand: ['subscription', 'line_items']
        });
            console.log('✅ Retrieved existing Stripe session:', { 
              id: stripeSession.id, 
              status: stripeSession.status,
              payment_status: stripeSession.payment_status,
              expires_at: stripeSession.expires_at
            });
            
            // Check if session is still usable
            const isOpen = stripeSession.status === 'open';
            const notExpired = !stripeSession.expires_at || (stripeSession.expires_at * 1000) > Date.now();
            const paidOrFree = 
              stripeSession.payment_status === 'paid' ||
              stripeSession.payment_status === 'no_payment_required';
            const notPaidOrFree = !paidOrFree;
            
            if (isOpen && notExpired && notPaidOrFree && stripeSession.url) {
              // ✅ Safe to reuse
              console.log('✅ Reusing existing valid session');
              return res.status(200).json({
                sessionUrl: stripeSession.url,
                sessionId: stripeSession.id,
              });
            } else {
              // ❌ Session not reusable, need fresh one
              needFreshSession = true;
              console.log('ℹ️ Existing session not reusable:', {
                status: stripeSession.status,
                payment_status: stripeSession.payment_status,
                expires_at: stripeSession.expires_at,
                reason: !isOpen ? 'not open' : !notExpired ? 'expired' : !notPaidOrFree ? 'already paid/free' : 'no URL'
              });
            }
          } catch (retrieveError) {
            // If retrieval fails, fall through to create a fresh session
            console.warn('⚠️ Failed to retrieve existing session, creating new one:', retrieveError);
            needFreshSession = true;
          }
        } else {
          console.log('📝 No existing valid checkout session found, will create new one');
        }

        try {
          console.log('📝 Creating/updating checkout session in database...');
          // First, create or update the checkout session
          const updatedCheckoutSession = await CheckoutSession.findOneAndUpdate(
            { pendingUserId: pendingUser._id },
            { 
              pendingUserEmail: pendingUser.email,
              expiresAt: new Date(Date.now() + 24*60*60*1000) // 24 hours from now
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );
          console.log('✅ Created/updated checkout session:', { id: updatedCheckoutSession._id });

          console.log('💳 Creating Stripe checkout session...');
          console.log('🔧 About to create Stripe session with URLs...');
          
          const baseUrl = getBaseUrl();
          const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
          const cancelUrl = `${baseUrl}/stripe/cancel`;
          
          console.log('🔧 Generated URLs:', { successUrl, cancelUrl });
          
          // Generate idempotency key to prevent duplicate sessions
          const baseKey = generateIdempotencyKey(
            pendingUser._id.toString(),
            payload.levelKey
          );
          
          // If we detected a non-reusable existing session above, add a nonce so Stripe doesn't hand us the old one
          const idempotencyKey = needFreshSession ? `${baseKey}:retry:${Date.now()}` : baseKey;
          
          console.log('🔑 Using idempotency key:', { baseKey, idempotencyKey, needFreshSession });
          
          const session = await stripe.checkout.sessions.create({
            mode: level.isRecurring ? 'subscription' : 'payment',
            line_items: [{ price: level.stripePriceId, quantity: 1 }],
            metadata: {
              pendingUserId: pendingUser._id.toString(),
              levelKey: payload.levelKey,
            },

            success_url: successUrl,
            cancel_url: cancelUrl,
          }, { 
            idempotencyKey 
          });
          console.log('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

          // Update the checkout session with the real Stripe session ID
          console.log('📝 Updating checkout session with Stripe session ID...');
          await CheckoutSession.findByIdAndUpdate(
            updatedCheckoutSession._id,
            { stripeSessionId: session.id }
          );
          console.log('✅ Updated checkout session with Stripe ID');

          console.log('🎉 Checkout session creation successful');
          return res.status(200).json({
            sessionUrl: session.url,
            sessionId: session.id,
          });
        } catch (err: any) {
          console.error('❌ Failed to create checkout session:', err);
          
          // Log detailed error information for debugging
          if (err.type) {
            console.error('Stripe error type:', err.type);
          }
          if (err.code) {
            console.error('Stripe error code:', err.code);
          }
          if (err.param) {
            console.error('Stripe error parameter:', err.param);
          }
          if (err.message) {
            console.error('Stripe error message:', err.message);
          }
          
          // Return more specific error message based on error type
          let errorMessage = 'Failed to create checkout session';
          if (err.type === 'StripeInvalidRequestError') {
            if (err.code === 'resource_missing') {
              errorMessage = 'Invalid price ID - please contact support';
            } else if (err.param === 'success_url' || err.param === 'cancel_url') {
              errorMessage = 'Invalid URL configuration - please contact support';
            } else {
              errorMessage = `Invalid request: ${err.message}`;
            }
          } else if (err.type === 'StripeAuthenticationError') {
            errorMessage = 'Payment service configuration error - please contact support';
          }
          
          return res
            .status(500)
            .json({ message: errorMessage });
        }
      } catch (tokenError: any) {
        console.error('❌ Checkout token verification failed:', tokenError.message);
        return res.status(400).json({ 
          message: 'Invalid or expired checkout token. Please verify your email again.' 
        });
      }
    } else if (userId) {
      // Handle existing-user flow (plan change) - requires authentication
      console.log('👤 Processing existing-user flow for userId:', userId);
      
      // Verify JWT token and account status
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        console.log('❌ No authorization token provided for existing user checkout');
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.id !== userId) {
          console.log('❌ Token user ID mismatch:', { tokenUserId: decoded.id, requestUserId: userId });
          return res.status(403).json({ message: 'Unauthorized access' });
        }
        
        // Check if user account exists and is active
        const user = await User.findById(userId);
        if (!user || user.isDeleted) {
          console.log('❌ User not found or account deactivated:', userId);
          return res.status(404).json({ message: 'Account not found or has been deactivated' });
        }
        
        console.log('✅ Found existing user:', { email: user.email, username: user.username });

        // Check if user has an existing active subscription
        console.log('🔍 Checking for existing active subscription...');
        const existingSubscription = await Subscription.findOne({ 
          userId: user._id, 
          status: 'ACTIVE' 
        });

        // Always go through checkout for plan changes - better UX and billing transparency
        console.log('💳 Creating checkout session for plan change');
        
        // Get levelKey from request body for existing users
        const { levelKey } = req.body;
        if (!levelKey) {
          return res.status(400).json({ message: 'levelKey is required for existing users' });
        }

        // Validate membership level
        const level = await MembershipLevel.findOne({ key: levelKey });
        if (!level) {
          return res.status(400).json({ message: 'Invalid levelKey' });
        }

        const baseUrl = getBaseUrl();
        const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/stripe/cancel`;
        
        console.log('🔧 Generated URLs for plan change:', { successUrl, cancelUrl });
        
        // Generate idempotency key
        const idempotencyKey = generateIdempotencyKey(
          user._id.toString(),
          levelKey
        );
        
        const session = await stripe.checkout.sessions.create({
          mode: level.isRecurring ? 'subscription' : 'payment',
          line_items: [{ price: level.stripePriceId, quantity: 1 }],
          metadata: {
            userId: user._id.toString(),
            levelKey,
          },

          success_url: successUrl,
          cancel_url: cancelUrl,
        }, { 
          idempotencyKey 
        });
        
        console.log('✅ Created checkout session for plan change:', { id: session.id, url: session.url });
        return res.status(200).json({
          sessionUrl: session.url,
          sessionId: session.id,
        });
      } catch (err: any) {
        console.error('❌ Failed to create checkout session for existing user:', err);
        
        // Log detailed error information for debugging
        if (err.type) {
          console.error('Stripe error type:', err.type);
        }
        if (err.code) {
          console.error('Stripe error code:', err.code);
        }
        if (err.param) {
          console.error('Stripe error parameter:', err.param);
        }
        if (err.message) {
          console.error('Stripe error message:', err.message);
        }
        
        // Return more specific error message based on error type
        let errorMessage = 'Failed to create checkout session';
        if (err.type === 'StripeInvalidRequestError') {
          if (err.code === 'resource_missing') {
            errorMessage = 'Invalid price ID - please contact support';
          } else if (err.param === 'success_url' || err.param === 'cancel_url') {
            errorMessage = 'Invalid URL configuration - please contact support';
          } else {
            errorMessage = `Invalid request: ${err.message}`;
          }
        } else if (err.type === 'StripeAuthenticationError') {
          errorMessage = 'Payment service configuration error - please contact support';
        }
        
        return res
          .status(500)
          .json({ message: errorMessage });
      }
    } else {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ message: 'checkoutToken or userId is required' });
    }
  } catch (err: any) {
    console.error('❌ Unhandled error in checkout route:', err);
    return res.status(500).json({ 
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// Verify session and return user authentication data
router.get('/verify-session', async (req, res) => {
  try {
    console.log('🔍 verify-session endpoint called with query:', req.query);
    console.log('🔍 verify-session called at:', new Date().toISOString());
    
    // 0) DB-first short-circuit
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return res.status(400).json({ message: 'Session ID is required and must start with cs_' });
    }

    try {
      await connectToDatabase();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const doc = await CheckoutSession.findOne({ stripeSessionId: session_id }).lean();
    if (doc && doc.ready && doc.userId) {
      const user = await User.findById(doc.userId);
      if (!user) return res.status(500).json({ message: 'User not found' });
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        ready: true,
        token,
        user: { _id: user._id, email: user.email, username: user.username, name: user.name }
      });
    }

    // 1) Not ready or not found → call Stripe once
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['subscription', 'line_items'] });
    } catch (e: any) {
      return res.status(400).json({ message: 'Invalid session ID or Stripe error' });
    }

    // Paid / free / complete?
    const paidOrComplete =
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required' ||
      session.status === 'complete';

    // Seed/refresh local doc for observability (no "ready" yet)
    await CheckoutSession.findOneAndUpdate(
      { stripeSessionId: session.id },
      {
        $set: {
          stripeSessionId: session.id,
          ...(session.metadata?.pendingUserId ? { pendingUserId: session.metadata.pendingUserId } : {}),
          ...(session.metadata?.userId ? { userId: session.metadata.userId } : {}),
          status: paidOrComplete ? 'COMPLETED' : 'CREATED',
          completedAt: paidOrComplete ? new Date() : undefined,
          stripeSessionStatus: session.status,
          stripePaymentStatus: session.payment_status,
          pendingUserEmail: session.customer_details?.email || session.metadata?.email || null,
          levelKey: session.metadata?.levelKey || null,
          expiresAt: new Date(Date.now() + 24*60*60*1000), // 24 hours from now
          // keep ready=false unless we actually set userId and finalize below
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!paidOrComplete) {
      // Not paid yet → tell client to keep polling (DB-first next time)
      return res.status(200).json({
        ready: false,
        stripeSessionStatus: session.status,
        stripePaymentStatus: session.payment_status,
        message: 'Payment not completed yet'
      });
    }

    // 2) Acquire finalization lock (idempotent) — 2 min stale lock breaker
    const lock = await CheckoutSession.findOneAndUpdate(
      {
        stripeSessionId: session.id,
        $or: [
          { finalizing: { $ne: true } },
          { finalizingAt: { $lte: new Date(Date.now() - 2 * 60 * 1000) } }
        ]
      },
      { $set: { finalizing: true, finalizingAt: new Date() } },
      { new: true }
    );

    if (!lock) {
      // Someone else is finalizing right now; tell client to poll again.
      return res.status(200).json({
        ready: false,
        stripeSessionStatus: session.status,
        stripePaymentStatus: session.payment_status,
        message: 'Finalizing your account…'
      });
    }

    // 3) Finalize exactly once (idempotent upserts)
    try {
      // Always run the centralized, idempotent heavy path
      const { user } = await finalizeCheckoutFromSession(session);

      // Mark session ready and attach userId
      await CheckoutSession.updateOne(
        { stripeSessionId: session.id },
        {
          $set: { ready: true, readyAt: new Date(), userId: user._id },
          $unset: { finalizing: "", finalizingAt: "" }
        }
      );

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        ready: true,
        token,
        user: { _id: user._id, email: user.email, username: user.username, name: user.name }
      });
    } catch (finalizeErr) {
      // Release lock on failure so a retry can proceed
      await CheckoutSession.updateOne(
        { stripeSessionId: session.id },
        { $unset: { finalizing: "", finalizingAt: "" } }
      );
      console.error('Finalization failed:', finalizeErr);
      return res.status(200).json({
        ready: false,
        stripeSessionStatus: session.status,
        stripePaymentStatus: session.payment_status,
        message: 'Finalization failed, retrying shortly'
      });
    }
  } catch (error) {
    console.error('❌ verify-session error:', error);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});



/**
 * GET /api/stripe/checkout/payment-status?sessionId=cs_...&pendingUserId=...
 * Returns { ready, stripeSessionStatus, stripePaymentStatus, pendingUserId, ... }
 */
router.get('/payment-status', async (req, res) => {
  try {
    await connectToDatabase();
    
    const sessionId = (req.query.sessionId as string | undefined)?.trim();
    const pendingUserId = (req.query.pendingUserId as string | undefined)?.trim();

    if (!sessionId && !pendingUserId) {
      return res.status(400).json({ 
        ready: false, 
        message: 'Missing sessionId or pendingUserId' 
      });
    }

    console.log('🔍 Payment status check:', { sessionId, pendingUserId });

    const doc = await CheckoutSession.findOne(
      sessionId
        ? { stripeSessionId: sessionId }
        : { pendingUserId }
    ).lean();

    // Default shape
    let response = {
      ready: false,
      message: 'Payment processing, finalizing shortly',
      stripeSessionStatus: null as string | null,
      stripePaymentStatus: null as string | null,
      pendingUserId: pendingUserId ?? null,
      stripeSessionId: sessionId ?? null,
    };

    if (!doc) {
      // Not found yet — caller can keep polling
      console.log('⏳ CheckoutSession not found yet, caller should keep polling');
      return res.status(200).json(response);
    }

    console.log('📦 Found CheckoutSession:', {
      id: String(doc._id),
      status: doc.status,
      ready: doc.ready,
      stripeSessionStatus: doc.stripeSessionStatus,
      stripePaymentStatus: doc.stripePaymentStatus
    });

    const isReady = doc.ready === true && !!doc.userId;

    response = {
      ...response,
      ready: isReady,
      stripeSessionStatus: doc.stripeSessionStatus ?? null,
      stripePaymentStatus: doc.stripePaymentStatus ?? null,
      pendingUserId: doc.pendingUserId ? String(doc.pendingUserId) : String(pendingUserId ?? ''),
      stripeSessionId: doc.stripeSessionId ?? response.stripeSessionId,
    };

    if (!isReady) {
      console.log('⏳ Session not ready yet, status:', doc.status);
      return res.status(200).json(response);
    }

    // Payment is ready - include additional info
    console.log('✅ Payment is ready!');
    return res.status(200).json({
      ...response,
      message: 'Payment complete',
      readyAt: doc.readyAt ?? null,
      levelKey: doc.levelKey ?? null,
      userId: doc.userId ? String(doc.userId) : null,
    });

  } catch (error) {
    console.error('❌ Payment status check failed:', error);
    res.status(500).json({ 
      ready: false,
      message: 'Failed to check payment status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/debug', async (req, res) => {
    try {
      await connectToDatabase();
      
      console.log('🔍 Debug endpoint called');
      
      // Check environment variables
      const envCheck = {
        hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        hasJwtSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
        databaseConnected: mongoose.connection.readyState === 1
      };
      
      console.log('🔍 Environment check:', envCheck);
      
      // Check database connection
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      // Check Stripe configuration
      let stripeCheck: { status: string; accountId?: string; error?: string } = { status: 'unknown' };
      try {
        const account = await stripe.accounts.retrieve();
        stripeCheck = { status: 'working', accountId: account.id };
      } catch (err: any) {
        stripeCheck = { status: 'error', error: err.message };
      }
      
      res.json({
        timestamp: new Date().toISOString(),
        environment: envCheck,
        database: dbStatus,
        stripe: stripeCheck,
        message: 'Debug endpoint working'
      });
    } catch (error) {
      console.error('❌ Debug endpoint error:', error);
      res.status(500).json({ 
        error: 'Debug endpoint failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}





export default router;
