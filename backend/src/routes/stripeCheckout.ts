//backend/src/routes/stripeCheckout.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { stripe } from '../lib/stripe';
import User from '../models/user.model';
import MembershipLevel from '../models/membershipLevel.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { getFrontendUrl } from '../config/urls';

import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders } from '../utils/accounts/security';
import { JWT_SECRET } from '../config/env';
import { ensureStripeCustomer } from '../utils/stripeCustomer';
import { generateVerifyNonce } from '../utils/security';

const router = Router();

// Apply security headers to all checkout routes
router.use(addSecurityHeaders);

/**
 * Clean up expired checkout sessions
 */
async function cleanupExpiredSessions() {
  try {
    const result = await CheckoutSession.updateMany(
      { 
        status: 'CREATED', 
        expiresAt: { $lt: new Date() } 
      },
      { $set: { status: 'EXPIRED' } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired checkout sessions`);
    }
  } catch (error) {
    console.error('❌ Failed to cleanup expired sessions:', error);
  }
}

// Root POST route removed to prevent duplicate checkout creation logic
// All checkout creation now goes through POST /stripe/checkout/start
/*
router.post('/', 
  createRateLimiter(50, 15 * 60 * 1000, 'custom', (req) => {
    // Rate limiting per IP for checkout
    return `ip:${req.ip}`;
  }),
  async (req, res) => {
  try {
    await connectToDatabase();
    
    // Clean up expired sessions before processing new requests
    await cleanupExpiredSessions();
    
    console.log('🛒 Starting checkout session creation...');
    console.log('🔧 Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL
    });
    
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
          console.log('❌ User not found or account not verified:', authedUserId, 'status:', user?.status);
          return res.status(404).json({ message: 'Account not found or not verified' });
        }
        console.log('✅ Found authenticated user:', { email: user.email, username: user.username });
      } catch (jwtError) {
        console.log('❌ Invalid JWT token:', jwtError);
        return res.status(401).json({ message: 'Invalid authentication token' });
      }
    } else {
      // Unauthenticated user flow (from email verification)
      const { email, firstName, lastName } = req.body;
      
      if (!email || !firstName || !lastName) {
        console.log('❌ Missing required fields for unauthenticated checkout');
        return res.status(400).json({ message: 'Email, firstName, and lastName are required for unauthenticated checkout' });
      }
      
      // Find user by email
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user || user.status !== 'VERIFIED_PENDING_PAYMENT') {
        console.log('❌ User not found or not in VERIFIED_PENDING_PAYMENT status:', email);
        return res.status(404).json({ message: 'Account not found or not ready for checkout' });
      }
      
      console.log('✅ Found unauthenticated user for checkout:', { email: user.email, username: user.username });
    }

    // Validate membership level first
    const level = await MembershipLevel.findOne({ key: levelKey });
    if (!level) {
      console.log('❌ Invalid membership level:', levelKey);
      return res.status(400).json({ message: 'Invalid levelKey' });
    }

    // Check if user already has an active subscription
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
          console.log('✅ Allowing subscription to lifetime switch:', {
            from: currentLevel.key,
            to: level.key,
            fromKind: activeSubscription.kind,
            toKind: level.isRecurring ? 'RECURRING' : 'ONE_TIME',
            reason: 'switching to lifetime'
          });
          
          console.log('🔄 User switching from subscription to lifetime - will cancel existing sub after payment');
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

    // Validate stripePriceId exists and is not empty
    if (!level.stripePriceId || level.stripePriceId.trim() === '') {
      console.log('❌ Membership level has no stripePriceId:', { levelKey, levelId: level._id });
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
    
    // Validate that the associated product is also active
    // Stripe can mark products inactive while leaving prices around
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (!product.active) {
      console.log('❌ Stripe product is inactive:', productId, 'for price:', level.stripePriceId);
      return res.status(400).json({ message: 'Selected membership product is not available' });
    }
    
    // Validate currency matches
    if (price.currency.toLowerCase() !== level.currency.toLowerCase()) {
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

    // Check for existing active checkout session for this user/level
    const existingSession = await CheckoutSession.findOne({
      userId: user._id,
      levelKey,
      status: 'CREATED',
      expiresAt: { $gt: new Date() }
    });

    if (existingSession) {
      console.log('🔄 Found existing active checkout session, reusing:', {
        sessionId: existingSession.stripeSessionId,
        createdAt: existingSession.createdAt,
        expiresAt: existingSession.expiresAt
      });

      // Verify the session still exists in Stripe and is valid
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(existingSession.stripeSessionId);
        
        if (stripeSession.status === 'open' && stripeSession.payment_status === 'unpaid') {
          console.log('✅ Existing Stripe session is still valid, reusing');
          return res.status(200).json({
            sessionUrl: stripeSession.url,
            sessionId: stripeSession.id,
            verifyNonce: existingSession.verifyNonce, // Use existing nonce
            reused: true
          });
        } else {
          console.log('⚠️ Existing Stripe session is no longer valid, will create new one');
          // Mark the old session as expired
          await CheckoutSession.updateOne(
            { _id: existingSession._id },
            { $set: { status: 'EXPIRED' } }
          );
        }
      } catch (stripeError) {
        console.log('⚠️ Could not retrieve existing Stripe session, will create new one:', stripeError);
        // Mark the old session as expired
        await CheckoutSession.updateOne(
          { _id: existingSession._id },
          { $set: { status: 'EXPIRED' } }
        );
      }
    }
        
        // Always ensure Stripe customer from the real user
        const customerId = await ensureStripeCustomer(user);

        // Generate idempotency key to prevent duplicate sessions on retries
    // Using stable key based on user, level, and customer to prevent duplicates
    const idemKey = `cs:create:${user._id}:${level.stripePriceId}:${customerId}`;
        
        const session = await stripe.checkout.sessions.create({
          mode: level.isRecurring ? 'subscription' : 'payment',
          customer: customerId,
          client_reference_id: user._id.toString(),
          line_items: [{ price: level.stripePriceId, quantity: 1 }],
          metadata: { userId: user._id.toString(), levelKey },
          ...(level.isRecurring
            ? {
                subscription_data: {
                  metadata: { userId: user._id.toString(), levelKey },
                },
              }
            : {
                payment_intent_data: {
                  metadata: { userId: user._id.toString(), levelKey },
                },
              }),
          billing_address_collection: 'auto',
          allow_promotion_codes: true,
      success_url: `${getFrontendUrl()}/stripe/success?session_id={CHECKOUT_SESSION_ID}&nonce=${verifyNonce}`,
      cancel_url: `${getFrontendUrl()}/stripe/cancel`,
        }, { idempotencyKey: idemKey });
    
        console.log('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

        // Create checkout session record with all required fields and proper TTL
        console.log('📝 Creating checkout session record...');
        if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
      try {
        const verifyNonce = generateVerifyNonce();
        
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
          console.log('✅ Created checkout session record with nonce:', verifyNonce);
      } catch (dbError: any) {
        // Handle duplicate key error (race condition)
        if (dbError.code === 11000 && dbError.keyPattern?.userId && dbError.keyPattern?.levelKey && dbError.keyPattern?.status) {
          console.log('⚠️ Duplicate checkout session detected (race condition), cleaning up Stripe session');
          
          // Clean up the Stripe session we just created
          try {
            await stripe.checkout.sessions.expire(session.id);
            console.log('✅ Expired duplicate Stripe session:', session.id);
          } catch (stripeError) {
            console.warn('⚠️ Failed to expire duplicate Stripe session:', stripeError);
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
          console.warn('⚠️ Invalid Stripe session ID format, skipping record creation:', session.id);
        }

        console.log('🎉 Checkout session creation successful');
        return res.status(200).json({
          sessionUrl: session.url,
          sessionId: session.id,
      verifyNonce: verifyNonce, // Include nonce for session verification
        });
    
      } catch (err: any) {
    console.error('❌ Unhandled error in checkout route:', err);
    return res.status(500).json({ 
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});
*/

// Start checkout route - handles deduplication and session creation
router.post('/start', 
  createRateLimiter(50, 15 * 60 * 1000, 'custom', (req) => {
    // Rate limiting per IP for checkout start
    return `ip:${req.ip}`;
  }),
  async (req, res) => {
  try {
    await connectToDatabase();
    
    // Clean up expired sessions before processing new requests
    await cleanupExpiredSessions();
    
    console.log('🚀 Starting checkout process...');
    
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
          console.log('❌ User not found or account not verified:', authedUserId, 'status:', user?.status);
          return res.status(404).json({ message: 'Account not found or not verified' });
        }
        console.log('✅ Found authenticated user:', { email: user.email, username: user.username });
      } catch (jwtError) {
        console.log('❌ Invalid JWT token:', jwtError);
        return res.status(401).json({ message: 'Invalid authentication token' });
      }
    } else {
      // Unauthenticated user flow (from email verification)
      const { email, firstName, lastName } = req.body;
      
      if (!email || !firstName || !lastName) {
        console.log('❌ Missing required fields for unauthenticated checkout');
        return res.status(400).json({ message: 'Email, firstName, and lastName are required for unauthenticated checkout' });
      }
      
      // Find user by email
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user || user.status !== 'VERIFIED_PENDING_PAYMENT') {
        console.log('❌ User not found or not in VERIFIED_PENDING_PAYMENT status:', email);
        return res.status(404).json({ message: 'Account not found or not ready for checkout' });
      }
      
      console.log('✅ Found unauthenticated user for checkout:', { email: user.email, username: user.username });
    }

    // Validate membership level first
    const level = await MembershipLevel.findOne({ key: levelKey });
    if (!level) {
      console.log('❌ Invalid membership level:', levelKey);
      return res.status(400).json({ message: 'Invalid levelKey' });
    }

    // Check if user already has an active subscription
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
          console.log('✅ Allowing subscription to lifetime switch:', {
            from: currentLevel.key,
            to: level.key,
            fromKind: activeSubscription.kind,
            toKind: level.isRecurring ? 'RECURRING' : 'ONE_TIME',
            reason: 'switching to lifetime'
          });
          
          console.log('🔄 User switching from subscription to lifetime - will cancel existing sub after payment');
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

    // Validate stripePriceId exists and is not empty
    if (!level.stripePriceId || level.stripePriceId.trim() === '') {
      console.log('❌ Membership level has no stripePriceId:', { levelKey, levelId: level._id });
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
    
    // Validate that the associated product is also active
    // Stripe can mark products inactive while leaving prices around
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (!product.active) {
      console.log('❌ Stripe product is inactive:', productId, 'for price:', level.stripePriceId);
      return res.status(400).json({ message: 'Selected membership product is not available' });
    }
    
    // Validate currency matches
    if (price.currency.toLowerCase() !== level.currency.toLowerCase()) {
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

    // Check for existing active checkout session for this user/level
    const existingSession = await CheckoutSession.findOne({
      userId: user._id,
      levelKey,
      status: 'CREATED',
      expiresAt: { $gt: new Date() }
    });

    if (existingSession) {
      console.log('🔄 Found existing active checkout session, reusing:', {
        sessionId: existingSession.stripeSessionId,
        createdAt: existingSession.createdAt,
        expiresAt: existingSession.expiresAt
      });

      // Verify the session still exists in Stripe and is valid
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(existingSession.stripeSessionId);
        
        if (stripeSession.status === 'open' && stripeSession.payment_status === 'unpaid') {
          console.log('✅ Existing Stripe session is still valid, reusing');
          return res.status(200).json({
            sessionUrl: stripeSession.url,
            sessionId: stripeSession.id,
            verifyNonce: existingSession.verifyNonce, // Use existing nonce
            reused: true
          });
        } else {
          console.log('⚠️ Existing Stripe session is no longer valid, will create new one');
          // Mark the old session as expired
          await CheckoutSession.updateOne(
            { _id: existingSession._id },
            { $set: { status: 'EXPIRED' } }
          );
        }
      } catch (stripeError) {
        console.log('⚠️ Could not retrieve existing Stripe session, will create new one:', stripeError);
        // Mark the old session as expired
        await CheckoutSession.updateOne(
          { _id: existingSession._id },
          { $set: { status: 'EXPIRED' } }
        );
      }
    }

    // Always ensure Stripe customer from the real user
    const customerId = await ensureStripeCustomer(user);

    // Generate idempotency key to prevent duplicate sessions on retries
    // Using stable key based on user, level, and customer to prevent duplicates
    const idemKey = `cs:create:${user._id}:${level.stripePriceId}:${customerId}`;
    
    // Generate nonce before creating Stripe session so we can include it in success_url
    const verifyNonce = generateVerifyNonce();
    
    const session = await stripe.checkout.sessions.create({
      mode: level.isRecurring ? 'subscription' : 'payment',
      customer: customerId,
      client_reference_id: user._id.toString(),
      line_items: [{ price: level.stripePriceId, quantity: 1 }],
      metadata: { userId: user._id.toString(), levelKey },
      ...(level.isRecurring
        ? {
            subscription_data: {
              metadata: { userId: user._id.toString(), levelKey },
            },
          }
        : {
            payment_intent_data: {
              metadata: { userId: user._id.toString(), levelKey },
            },
          }),
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      success_url: `${getFrontendUrl()}/stripe/success?session_id={CHECKOUT_SESSION_ID}&nonce=${verifyNonce}`,
      cancel_url: `${getFrontendUrl()}/stripe/cancel`,
    }, { idempotencyKey: idemKey });
    
    console.log('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

    // Create checkout session record with all required fields and proper TTL
    console.log('📝 Creating checkout session record...');
    
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
        console.log('✅ Created checkout session record with nonce:', verifyNonce);
      } catch (dbError: any) {
        // Handle duplicate key error (race condition)
        if (dbError.code === 11000 && dbError.keyPattern?.userId && dbError.keyPattern?.levelKey && dbError.keyPattern?.status) {
          console.log('⚠️ Duplicate checkout session detected (race condition), cleaning up Stripe session');
          
          // Clean up the Stripe session we just created
          try {
            await stripe.checkout.sessions.expire(session.id);
            console.log('✅ Expired duplicate Stripe session:', session.id);
          } catch (stripeError) {
            console.warn('⚠️ Failed to expire duplicate Stripe session:', stripeError);
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
      console.warn('⚠️ Invalid Stripe session ID format, skipping record creation:', session.id);
    }

    console.log('🎉 Checkout session creation successful');
    return res.status(200).json({
      sessionUrl: session.url,
      sessionId: session.id,
      verifyNonce: verifyNonce, // Include nonce for session verification
    });
    
  } catch (err: any) {
    console.error('❌ Unhandled error in checkout start route:', err);
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
    console.log('🔍 Verifying session:', session_id);
    const doc = await CheckoutSession.findOne({ stripeSessionId: session_id }).lean() as any;
    
    // Verify nonce to prevent unauthorized access
    if (!doc || doc.verifyNonce !== nonce) {
      // Log only IDs for security - no sensitive nonce values
      console.log('❌ Nonce verification failed:', { 
        sessionId: session_id, 
        docId: doc?._id ? String(doc._id) : 'not_found',
        docExists: !!doc 
      });
      return res.status(403).json({ 
        message: 'Verification mismatch',
        error: 'nonce_mismatch'
      });
    }
    
    console.log('✅ Nonce verification successful');
    console.log('📦 CheckoutSession document:', doc ? {
      id: String(doc._id),
      status: doc.status,
      userId: doc.userId,
      stripeSessionId: doc.stripeSessionId
    } : 'Not found');

    // ✅ Only ready when webhooks flipped it
    if (doc?.ready === true && doc.userId) {
      const user = await User.findById(doc.userId).select('-passwordHash').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        ready: true,
        token,
        user,
        message: 'Payment completed successfully',
        flow: 'webhook-only'
      });
    }
    return res.status(200).json({
      ready: false,
      message: 'Awaiting webhook fulfillment',
      flow: 'webhook-only'
    });
  } catch (e: any) {
    console.error('verify-session error:', e?.message || e);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});


router.get('/payment-status', 
  createRateLimiter(60, 60 * 1000, 'custom', (req) => {
    // Rate limiting per sessionId for payment status checks
    // Increased from 10 to 60 requests per minute to accommodate frontend polling every 2s
    const sessionId = (req.query.sessionId as string | undefined)?.trim();
    return sessionId ? `session:${sessionId}` : `ip:${req.ip}`;
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

    const ready = !!doc.ready && !!doc.userId;
    return res.status(200).json({
      ready,
      message: ready ? 'Payment complete' : 'Processing…',
      readyAt: doc.readyAt ?? null,
      userId: doc.userId ? String(doc.userId) : null,
      levelKey: doc.levelKey ?? null,
      sessionId: doc.stripeSessionId,
    });
  } catch (e) {
    console.error('payment-status error:', e);
    return res.status(500).json({ ready: false, message: 'Failed to check payment status' });
  }
});



export default router;
