import express, { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { stripe } from '../lib/stripe';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import MembershipLevel from '../models/membershipLevel.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { getFrontendUrl } from '../config/urls';
import { sendWelcomeEmail } from '../utils/email/email';
import { generateCheckoutToken, verifyCheckoutToken, generateIdempotencyKey } from '../utils/accounts/checkoutTokens';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders } from '../utils/accounts/security';
import { JWT_SECRET } from '../config/env';
import { ensureStripeCustomer } from '../utils/stripeCustomer';

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
        return `ip:${req.ip}`; // Fallback to IP if token is invalid
      }
    }
    return `ip:${req.ip}`;
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

        // Ensure/reuse Stripe customer to prevent duplicate customers
        let customerId: string;
        if (existingUser) {
          // reuse the real user's customer
          customerId = await ensureStripeCustomer(existingUser);
        } else {
          // optional but clean: precreate one for the pending user so you control the id
          const c = await stripe.customers.create({
            email: pendingUser.email,
            metadata: { pendingUserId: pendingUser._id.toString() },
            name: `${pendingUser.name.first} ${pendingUser.name.last}`.trim()
          });
          customerId = c.id;
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
        const price = await stripe.prices.retrieve(level.stripePriceId);
        if (!price.active) {
          console.log('❌ Stripe price is inactive:', level.stripePriceId);
          return res.status(400).json({ message: 'Selected membership level is not available' });
        }
        
        // Validate currency matches
        if (price.currency !== level.currency) {
          console.log('❌ Currency mismatch:', { 
            priceCurrency: price.currency, 
            levelCurrency: level.currency,
            priceId: level.stripePriceId 
          });
          return res.status(400).json({ message: 'Price configuration mismatch' });
        }
        
        // Validate interval for recurring plans
        if (level.isRecurring && price.recurring?.interval !== level.interval) {
          console.log('❌ Interval mismatch for recurring plan:', { 
            priceInterval: price.recurring?.interval, 
            levelInterval: level.interval,
            priceId: level.stripePriceId 
          });
          return res.status(400).json({ message: 'Price configuration mismatch' });
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
              status: 'CREATED', // ← explicit for clarity
              expiresAt: new Date(Date.now() + 24*60*60*1000) // 24 hours from now
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );
          console.log('✅ Created/updated checkout session:', { id: updatedCheckoutSession._id });

          console.log('💳 Creating Stripe checkout session...');
          console.log('🔧 About to create Stripe session with URLs...');
          
          const baseUrl = getFrontendUrl();
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
          // This part is removed as BillingProfile is no longer used

          const session = await stripe.checkout.sessions.create({
            mode: level.isRecurring ? 'subscription' : 'payment',
            customer: customerId,                         // 👈 prevent a new Customer
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

          // Update the checkout session with the real Stripe session ID and additional data
          console.log('📝 Updating checkout session with Stripe session ID and additional data...');
          if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
            await CheckoutSession.findByIdAndUpdate(
              updatedCheckoutSession._id,
              { 
                stripeSessionId: session.id,
                customerId: customerId,
                priceId: level.stripePriceId,
                ready: false
              }
            );
            console.log('✅ Updated checkout session with Stripe ID and additional data');
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

        // Guard: if user already has any active subscription, disallow checkout to prevent index conflicts
        const active = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' });
        if (active) {
          return res.status(400).json({
            message: 'You already have an active membership. Use the billing portal to manage it.',
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
        
        const baseUrl = getFrontendUrl();
        const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/stripe/cancel`;
        
        console.log('🔧 Generated URLs for one-time purchase:', { successUrl, cancelUrl });
        
        // Generate idempotency key
        const idempotencyKey = generateIdempotencyKey(
          user._id.toString(),
          levelKey
        );
        
        // ensure BillingProfile for existing user email
        // This part is removed as BillingProfile is no longer used
        
        // Always ensure + pass customer to prevent duplicate customers
        const customerId = await ensureStripeCustomer(user); // creates only if missing
        
        // Create checkout session for one-time purchase only
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer: customerId, // never let Checkout guess
          line_items: [{ price: level.stripePriceId, quantity: 1 }],
          metadata: {
            userId: user._id.toString(), // canonical
            levelKey,
            // billingProfileId: String(bp._id), // This line is removed
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
                customerId: customerId,
                priceId: level.stripePriceId,
                userId: user._id,
                status: 'CREATED',
                levelKey,
                expiresAt: new Date(Date.now() + 24*60*60*1000), // 24 hours
                ready: false,
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

    // Check if webhook has already processed this session
    if (doc?.ready && doc.userId) {
      // Session is ready, get user data and generate JWT token
      const user = await User.findById(doc.userId).select('-passwordHash').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate JWT token for the user
      const tokenPayload = { 
        id: user._id, 
        membershipLevel: user.membershipLevel || null 
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

      // Return authentication data
      return res.status(200).json({
        ready: true,
        token,
        user,
        stripeSessionStatus: doc.stripeSessionStatus ?? null,
        stripePaymentStatus: doc.stripePaymentStatus ?? null,
        message: 'Payment completed successfully',
        flow: 'webhook-only'
      });
    } else if (doc?.stripeSessionStatus === 'complete' || doc?.stripePaymentStatus === 'paid') {
      // Webhook has processed but session not marked ready yet
      return res.status(200).json({
        ready: false,
        stripeSessionStatus: doc.stripeSessionStatus ?? null,
        stripePaymentStatus: doc.stripePaymentStatus ?? null,
        message: 'Payment completed, finalizing account setup...',
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
        hasWebhookSecret: true, // Validated by env module
        hasJwtSecret: true,
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
