import { Router } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import MembershipLevel from '../models/membershipLevel.model';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import jwt from 'jsonwebtoken';
import { getFrontendUrl } from '../config/urls';
import { connectToDatabase } from '../utils/db';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { verifyCheckoutToken, generateIdempotencyKey } from '../utils/accounts/checkoutTokens';
import { requireAuth } from '../middleware/requireAuth';
import { clientIp, validateStripePrice, getBaseUrl, envAllowOnBehalf, isOwnedBy } from '../utils';

import mongoose, { Types } from 'mongoose';
import BillingProfile from '../models/billingProfile.model';

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();

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
          
          // before creating the session, ensure a BillingProfile exists for that email
          const bp = await BillingProfile.findOneAndUpdate(
            { normalizedEmail: pendingUser.email.trim().toLowerCase() },
            { $setOnInsert: { email: pendingUser.email, name: pendingUser.name ? `${pendingUser.name.first} ${pendingUser.name.last}`.trim() : null } },
            { upsert: true, new: true }
          );
          console.log('✅ BillingProfile ensured for new user:', { 
            id: bp._id, 
            email: bp.email, 
            name: bp.name,
            wasCreated: !bp.stripeCustomerId 
          });
          
          const session = await stripe.checkout.sessions.create({
            mode: level.isRecurring ? 'subscription' : 'payment',
            line_items: [{ price: level.stripePriceId, quantity: 1 }],
            metadata: {
              beneficiaryUserId: pendingUser._id.toString(), // canonical
              levelKey: payload.levelKey,
              billingProfileId: String(bp._id),
            },

            success_url: successUrl,
            cancel_url: cancelUrl,
          }, { 
            idempotencyKey 
          });
          console.log('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

          // Update the checkout session with the real Stripe session ID
          console.log('📝 Updating checkout session with Stripe session ID...');
          if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
            await CheckoutSession.findByIdAndUpdate(
              updatedCheckoutSession._id,
              { stripeSessionId: session.id }
            );
            console.log('✅ Updated checkout session with Stripe ID');
          } else {
            console.warn('⚠️ Invalid Stripe session ID format, skipping update:', session.id);
          }

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
      // Handle existing-user flow - one-time purchases only
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

        // Guard: if user already has lifetime (ONE_TIME) plan in ACTIVE, disallow further plan switches via Checkout
        const active = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' });
        if (active?.kind === 'ONE_TIME') {
          return res.status(400).json({
            message:
              'You already have a lifetime membership. Plan changes are not needed. If you believe this is an error, contact support.',
          });
        }

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

        // Block recurring subscriptions for existing users - they must use billing portal
        if (level.isRecurring) {
          console.log('❌ Recurring subscriptions blocked for existing users - use billing portal instead');
          return res.status(400).json({
            message: 'Use the billing portal to manage subscription plans. Checkout is only for one-time purchases.',
          });
        }

        // Allow one-time purchases for existing users
        console.log('💳 Creating checkout session for one-time purchase');
        
        const baseUrl = getBaseUrl();
        const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/stripe/cancel`;
        
        console.log('🔧 Generated URLs for one-time purchase:', { successUrl, cancelUrl });
        
        // Generate idempotency key
        const idempotencyKey = generateIdempotencyKey(
          user._id.toString(),
          levelKey
        );
        
        // ensure BillingProfile for existing user email
        const bp = await BillingProfile.findOneAndUpdate(
          { normalizedEmail: user.email.trim().toLowerCase() },
          { $setOnInsert: { email: user.email, name: user.name ? `${user.name.first} ${user.name.last}`.trim() : null } },
          { upsert: true, new: true }
        );
        console.log('✅ BillingProfile ensured for existing user:', { 
          id: bp._id, 
          email: bp.email, 
          name: bp.name,
          wasCreated: !bp.stripeCustomerId 
        });
        
        // Create checkout session for one-time purchase only
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_creation: 'always',
          line_items: [{ price: level.stripePriceId, quantity: 1 }],
          metadata: {
            beneficiaryUserId: user._id.toString(), // canonical
            levelKey,
            billingProfileId: String(bp._id),
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        }, { 
          idempotencyKey 
        });
        
        // Upsert CheckoutSession doc immediately for observability
        if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
          await CheckoutSession.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              $set: {
                stripeSessionId: session.id,
                userId: user._id,
                status: 'CREATED',
                levelKey,
                expiresAt: new Date(Date.now() + 24*60*60*1000), // 24 hours
              }
            },
            { upsert: true, new: true }
          );
        } else {
          console.warn('⚠️ Invalid Stripe session ID format, skipping CheckoutSession creation:', session.id);
        }
        
        console.log('✅ Created checkout session for one-time purchase:', { id: session.id, url: session.url });
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
// Note: v2 sessions (webhook-driven) are handled differently and don't go through finalization
router.get('/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return res.status(400).json({ message: 'Session ID is required and must start with cs_' });
    }

    await connectToDatabase();
    const doc = await CheckoutSession.findOne({ stripeSessionId: session_id }).lean() as any;

    // If webhook already marked this session as completed/ready (v1 or v2), return it
    if (doc?.status === 'COMPLETED') {
      return res.status(200).json({
        ready: !!doc.userId,                      // if you attach it post-webhook
        stripeSessionStatus: doc.stripeSessionStatus ?? null,
        stripePaymentStatus: doc.stripePaymentStatus ?? null,
        message: 'Fulfillment handled by webhook',
        flow: 'webhook-only'
      });
    }

    // Otherwise look at Stripe once, then let client keep polling
    const session = await stripe.checkout.sessions.retrieve(session_id);
    return res.status(200).json({
      ready: false,
      stripeSessionStatus: session.status,
      stripePaymentStatus: session.payment_status,
      message: 'Awaiting webhook fulfillment',
      flow: 'webhook-only'
    });
  } catch (e: any) {
    console.error('verify-session error:', e?.message || e);
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
    ).lean() as any;

    // Default shape
    let response: {
      ready: boolean;
      message: string;
      stripeSessionStatus: string | null;
      stripePaymentStatus: string | null;
      pendingUserId: string | null;
      stripeSessionId?: string | null;
    } = {
      ready: false,
      message: 'Payment processing, finalizing shortly',
      stripeSessionStatus: null,
      stripePaymentStatus: null,
      pendingUserId: pendingUserId ?? null,
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
      stripeSessionId: doc.stripeSessionId ?? null,
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

/**
 * GET /api/stripe/checkout/v2/validate-billing-profile?email=... or ?billingProfileId=...
 * Returns billing profile info to help frontend decide how to proceed
 */
router.get('/v2/validate-billing-profile', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { email, billingProfileId } = req.query;
    
    if (!email && !billingProfileId) {
      return res.status(400).json({ 
        message: 'Either email or billingProfileId is required' 
      });
    }

    let billingProfile = null;
    
    if (billingProfileId) {
      billingProfile = await BillingProfile.findById(billingProfileId);
      if (!billingProfile) {
        return res.status(404).json({ 
          message: 'Billing profile not found',
          suggestion: 'Use a valid billingProfileId or create a new profile with email'
        });
      }
    } else if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      billingProfile = await BillingProfile.findOne({ normalizedEmail });
    }

    if (!billingProfile) {
      return res.status(200).json({
        exists: false,
        message: 'No billing profile found for this email',
        suggestion: 'Create a new profile by passing billingEmail in checkout'
      });
    }

    // Profile exists
    const response: any = {
      exists: true,
      billingProfileId: billingProfile._id,
      hasStripeCustomer: !!billingProfile.stripeCustomerId,
      email: billingProfile.email,
      name: billingProfile.name
    };

    if (billingProfile.stripeCustomerId) {
      response.message = 'Billing profile exists with Stripe customer - use billingProfileId to prevent duplicate customers';
      response.recommendation = 'Pass billingProfileId in checkout request';
    } else {
      response.message = 'Billing profile exists but no Stripe customer yet';
      response.recommendation = 'Pass billingProfileId in checkout request - customer will be created automatically';
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Billing profile validation error:', error);
    res.status(500).json({ 
      message: 'Failed to validate billing profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/stripe/checkout/v2 - New BillingProfile-aware checkout route
 * Handles customer creation/reuse and billing profile management
 * 
 * SECURITY FEATURES:
 * - Validates priceId against catalog (no client trust)
 * - Builds URLs server-side (prevents open redirects)
 * - Validates quantity limits (prevents abuse)
 * - Rate limiting via existing middleware
 * 
 * IDEMPOTENCY:
 * - Prevents duplicate checkout sessions
 * - Key based on: beneficiaryUserId + priceId + mode + billingProfileId
 * - Returns 409 Conflict for duplicate requests
 */
router.post('/v2', requireAuth, async (req, res) => {
  try {
    await connectToDatabase();
    
    console.log('🛒 Starting BillingProfile-aware checkout session creation...');
    
    // --- Ownership / Authorization guardrails ---
    const callerId = req.auth!.id; // guaranteed by middleware
    let { beneficiaryUserId } = req.body as { beneficiaryUserId?: string };
    beneficiaryUserId = beneficiaryUserId?.trim() || callerId; // default to self

    // Self-only policy (Phase 1). We'll relax this in Phase 2.
    if (beneficiaryUserId !== callerId) {
      return res.status(403).json({ message: 'Purchasing on behalf of another user is not allowed.' });
    }

    // Validate beneficiary user exists and is active
    const beneficiary = await User.findById(beneficiaryUserId);
    if (!beneficiary || beneficiary.isDeleted) {
      return res.status(404).json({ message: 'Beneficiary account not found or deactivated' });
    }
    
    const {
      // allow FE to choose a payer or create by email
      billingProfileId,
      billingEmail,     // optional, used to create/find BillingProfile
      billingName,      // optional
      // product choice
      priceId,          // for both sub or lifetime
      mode,             // 'subscription' | 'payment'
      quantity = 1,
      // optional: tell Stripe we want to save PM for reuse
      saveForFuture = (mode === 'subscription')
    } = req.body;

    console.log('📋 Request body:', { 
      beneficiaryUserId, 
      billingProfileId, 
      billingEmail, 
      billingName,
      priceId, 
      mode, 
      quantity 
    });

    // Validate required fields
    if (!priceId) {
      return res.status(400).json({ message: 'priceId is required' });
    }
    if (!mode || !['subscription', 'payment'].includes(mode)) {
      return res.status(400).json({ message: 'mode must be "subscription" or "payment"' });
    }

    // Validate quantity (prevent abuse)
    if (typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
      console.log('❌ Invalid quantity:', quantity);
      return res.status(400).json({ message: 'Quantity must be a number between 1 and 100' });
    }

    // a) Validate priceId via your catalog (don't trust client)
    console.log('🔍 Validating priceId against catalog:', priceId);
    const level = await MembershipLevel.findOne({ stripePriceId: priceId });
    if (!level) {
      console.log('❌ Invalid or unknown priceId:', priceId);
      return res.status(400).json({ message: 'Invalid or unknown priceId' });
    }
    console.log('✅ PriceId validated against catalog:', { 
      levelId: level._id, 
      levelKey: level.key, 
      priceId: level.stripePriceId 
    });

    // Validate that the Stripe price exists and is active
    const isPriceValid = await validateStripePrice(priceId);
    if (!isPriceValid) {
      console.log('❌ Stripe price is invalid or inactive:', priceId);
      return res.status(400).json({ message: 'Selected membership level is not available' });
    }

    // b) Build URLs server-side (avoid open redirect)
    // Ignore any client-provided success_url/cancel_url for security
    const baseUrl = getBaseUrl();
    const success_url = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${baseUrl}/stripe/cancel`;
    
    console.log('🔗 Generated secure URLs:', { 
      baseUrl, 
      success_url, 
      cancel_url 
    });

    // 1) Resolve/create BillingProfile with ownership enforcement
    let bp = null;
    const onBehalf = beneficiaryUserId !== callerId;
    if (onBehalf && !envAllowOnBehalf()) {
      return res.status(403).json({ message: 'On-behalf checkout is disabled.' });
    }

    if (billingProfileId) {
      console.log('🔍 Looking up existing billing profile:', billingProfileId);
      bp = await BillingProfile.findById(billingProfileId);
      if (!bp) {
        console.log('❌ Invalid billingProfileId:', billingProfileId);
        return res.status(400).json({ message: 'Invalid billingProfileId' });
      }
      console.log('✅ Found existing billing profile:', { 
        id: bp._id, 
        email: bp.email, 
        hasStripeCustomer: !!bp.stripeCustomerId,
        ownerUserId: bp.ownerUserId
      });

      // Enforce ownership for on-behalf OR anytime (recommended)
      if (!isOwnedBy(bp, callerId)) {
        // Legacy: allow auto-claim ONLY if no customer yet
        if (!bp.ownerUserId && !bp.stripeCustomerId) {
          await BillingProfile.updateOne({ _id: bp._id }, { $set: { ownerUserId: callerId } });
          bp.ownerUserId = callerId;
          console.log('🔒 Auto-claimed legacy billing profile for caller:', callerId);
        } else {
          return res.status(403).json({ message: 'You do not own this billing profile.' });
        }
      }
      
      // Guard rail: If billing profile already has a customer, ensure we're not trying to create a new one
      if (bp.stripeCustomerId && billingEmail && bp.email !== billingEmail) {
        console.log('⚠️ Warning: Billing profile already has customer but email differs:', {
          existingEmail: bp.email,
          newEmail: billingEmail
        });
        // Don't block, but log the warning
      }
    } else if (billingEmail) {
      console.log('🔍 Looking up billing profile by email:', billingEmail);
      const normalizedEmail = String(billingEmail).trim().toLowerCase();
      bp = await BillingProfile.findOne({ normalizedEmail });
      
      if (bp) {
        console.log('✅ Found existing billing profile by email:', { 
          id: bp._id, 
          email: bp.email, 
          hasStripeCustomer: !!bp.stripeCustomerId,
          ownerUserId: bp.ownerUserId
        });
        
        // Existing profile by email must be owned or claimable (no hijack)
        if (!isOwnedBy(bp, callerId)) {
          if (!bp.ownerUserId && !bp.stripeCustomerId) {
            await BillingProfile.updateOne({ _id: bp._id }, { $set: { ownerUserId: callerId } });
            bp.ownerUserId = callerId;
            console.log('🔒 Auto-claimed legacy billing profile for caller:', callerId);
          } else {
            return res.status(403).json({ message: 'Email already tied to another billing profile.' });
          }
        }
        
        // Guard rail: Suggest using billingProfileId instead of email for existing profiles
        if (bp.stripeCustomerId) {
          console.log('💡 Tip: Consider using billingProfileId instead of email for existing customers to prevent duplicates');
        }
      } else {
        console.log('📝 Creating new billing profile for email:', billingEmail);
        bp = await BillingProfile.create({
          email: billingEmail, 
          name: billingName || null,
          ownerUserId: callerId,
        });
        console.log('✅ Created new billing profile:', { id: bp._id, email: bp.email, ownerUserId: callerId });
      }
    } else {
      // last resort: create a placeholder but assign owner to caller
      console.log('📝 Creating placeholder billing profile (no email provided)');
      bp = await BillingProfile.create({ ownerUserId: callerId });
      console.log('✅ Created placeholder billing profile:', { id: bp._id, ownerUserId: callerId });
    }

    // 2) If purchasing on behalf, enforce ownership of the billing profile
    if (onBehalf && !isOwnedBy(bp, callerId)) {
      return res.status(403).json({ message: 'On-behalf checkout requires owning the billing profile.' });
    }

    // 2) Build Checkout Session params
    console.log('🔧 Building checkout session parameters...');
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: mode as any,
      line_items: [{ price: priceId, quantity }],
      success_url,
      cancel_url,
      // always tag who benefits + who pays
      metadata: {
        beneficiaryUserId: String(beneficiaryUserId),
        billingProfileId: String(bp._id),
      },
    };

    // 3) Enforce single Customer per billing party
    if (bp.stripeCustomerId) {
      console.log('🔗 Using existing Stripe customer:', bp.stripeCustomerId);
      params.customer = bp.stripeCustomerId;
    } else {
      // force creation so we can capture and store the new Customer on webhook
      console.log('🆕 Forcing new Stripe customer creation');
      (params as any).customer_creation = 'always';
      if (bp.email) {
        params.customer_email = bp.email;
        console.log('📧 Setting customer_email for new customer:', bp.email);
      }
    }

    // 4) Saving PM for future use (helps reuse same card across multiple purchases)
    if (mode === 'payment' && saveForFuture) {
      console.log('💳 Enabling payment method saving for future use');
      params.payment_intent_data = { setup_future_usage: 'off_session' };
    }
    // subscription mode already implies a Customer and a default payment method

    console.log('💳 Creating Stripe checkout session with params:', {
      mode: params.mode,
      hasCustomer: !!params.customer,
      customerCreation: (params as any).customer_creation,
      hasCustomerEmail: !!params.customer_email,
      metadata: params.metadata
    });

    // Generate idempotency key to prevent duplicate sessions
    const idemKey = generateIdempotencyKey(String(beneficiaryUserId), `${priceId}:${mode}:${String(bp._id)}`);
    console.log('🔑 Using idempotency key:', {
      key: idemKey,
      components: {
        beneficiaryUserId: String(beneficiaryUserId),
        priceId,
        mode,
        billingProfileId: String(bp._id)
      }
    });

    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: idemKey });
    console.log('✅ Created Stripe checkout session:', { 
      id: session.id, 
      url: session.url, 
      mode: session.mode,
      customerId: session.customer
    });

    // Store a local record with pointers
    console.log('📝 Creating local checkout session record...');
    const checkoutSession = await CheckoutSession.create({
      stripeSessionId: session.id,
      billingProfileId: bp._id,
      beneficiaryUserId,
      status: 'CREATED',
      priceId, // dedicated field for Stripe price ID
      pendingUserEmail: bp.email || null,
      stripeSessionStatus: session.status,
      stripePaymentStatus: session.payment_status,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    });
    console.log('✅ Created local checkout session record:', { id: checkoutSession._id });

    // If this is a new customer, we'll need to update the billing profile on webhook
    if (!bp.stripeCustomerId && session.customer) {
      console.log('🔄 New Stripe customer created, will update billing profile on webhook:', session.customer);
    }

    console.log('🎉 Checkout session creation successful');
    res.json({ 
      id: session.id, 
      url: session.url,
      billingProfileId: bp._id,
      customerId: session.customer
    });
  } catch (err: any) {
    console.error('❌ BillingProfile checkout error:', err);
    
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
    
    // Handle idempotency conflicts specifically
    if (err.code === 'idempotency_key_in_use') {
      console.log('🔄 Idempotency conflict detected - duplicate request prevented');
      return res.status(409).json({ 
        message: 'Duplicate checkout request detected. Please wait a moment and try again.',
        code: 'IDEMPOTENCY_CONFLICT'
      });
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
    
    res.status(500).json({ message: errorMessage });
  }
});

export default router;
