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

const router = Router();



router.post('/', 
  createRateLimiter(50, 15 * 60 * 1000, 'custom', (req) => {
    // Rate limiting per IP for checkout
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
        if (!user || (user.status !== 'ACTIVE' && user.status !== 'VERIFIED_PENDING_PAYMENT')) {
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

    // Guard: if user already has any active subscription, disallow checkout to prevent index conflicts
    const active = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' });
      if (active) {
        return res.status(400).json({
          message: 'You already have an active membership. Use the billing portal to manage it.',
        });
      }

    // Validate membership level
    const level = await MembershipLevel.findOne({ key: levelKey });
    if (!level) {
      console.log('❌ Invalid membership level:', levelKey);
      return res.status(400).json({ message: 'Invalid levelKey' });
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

    // Simplified: Always create a new checkout session
    console.log('📝 Creating new checkout session...');

    try {
        console.log('📝 Creating Stripe checkout session...');

        console.log('🔧 About to create Stripe session with URLs...');
        
        const baseUrl = getFrontendUrl();
        const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/stripe/cancel`;
        
        console.log('🔧 Generated URLs:', { successUrl, cancelUrl });
        
        // Always ensure Stripe customer from the real user
        const customerId = await ensureStripeCustomer(user);

        const session = await stripe.checkout.sessions.create({
          mode: level.isRecurring ? 'subscription' : 'payment',
          customer: customerId,                         // 👈 prevent a new Customer
          line_items: [{ price: level.stripePriceId, quantity: 1 }],
          metadata: {
            userId: user._id.toString(), // 👈 always use real user ID
            levelKey,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });
        console.log('✅ Created Stripe session:', { id: session.id, url: session.url, mode: session.mode });

        // Create a simple checkout session record for tracking
        console.log('📝 Creating checkout session record...');
        if (typeof session.id === 'string' && /^cs_/.test(session.id)) {
          await CheckoutSession.create({
            userId: user._id,
            stripeSessionId: session.id,
            levelKey,
            status: 'CREATED',
            expiresAt: new Date(Date.now() + 24*60*60*1000) // 24 hours from now
          });
          console.log('✅ Created checkout session record');
        } else {
          console.warn('⚠️ Invalid Stripe session ID format, skipping record creation:', session.id);
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
    console.log('🔍 Verifying session:', session_id);
    const doc = await CheckoutSession.findOne({ stripeSessionId: session_id }).lean() as any;
    console.log('📦 CheckoutSession document:', doc ? {
      id: String(doc._id),
      status: doc.status,
      userId: doc.userId,
      stripeSessionId: doc.stripeSessionId
    } : 'Not found');

    // Check if webhook has already processed this session
    if (doc?.status === 'COMPLETED' && doc.userId) {
      // Session is ready, get user data and generate JWT token
      const user = await User.findById(doc.userId).select('-passwordHash').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate JWT token for the user
      const tokenPayload = { 
        id: user._id
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

      // Return authentication data
      return res.status(200).json({
        ready: true,
        token,
        user,
        message: 'Payment completed successfully',
        flow: 'webhook-only'
      });
    }

    // Otherwise look at Stripe once, then let client keep polling
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // If Stripe shows the session is complete but our webhook hasn't processed yet,
    // we can try to get the user ID from the session metadata as a fallback
    console.log('🔍 Stripe session status:', {
      payment_status: session.payment_status,
      metadata: session.metadata
    });
    
    if (session.payment_status === 'paid' && session.metadata?.userId) {
      console.log('🔄 Attempting fallback authentication via session metadata');
      const user = await User.findById(session.metadata.userId).select('-passwordHash').lean();
      if (user) {
        console.log('✅ Fallback authentication successful for user:', user.email);
        // Generate JWT token for the user
        const tokenPayload = { 
          id: user._id
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        // Return authentication data
        return res.status(200).json({
          ready: true,
          token,
          user,
          message: 'Payment completed successfully (fallback)',
          flow: 'webhook-fallback'
        });
      } else {
        console.log('❌ Fallback authentication failed - user not found:', session.metadata.userId);
      }
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



/**
 * GET /api/stripe/checkout/payment-status?sessionId=cs_...
 * Returns { ready, stripeSessionStatus, stripePaymentStatus, userId, ... }
 */
router.get('/payment-status', async (req, res) => {
  try {
    await connectToDatabase();
    
    const sessionId = (req.query.sessionId as string | undefined)?.trim();

    if (!sessionId) {
      return res.status(400).json({ 
        ready: false, 
        message: 'Missing sessionId' 
      });
    }

    console.log('🔍 Payment status check:', { sessionId });

    const doc = await CheckoutSession.findOne({ stripeSessionId: sessionId }).lean() as any;

    // Default shape
    let response: {
      ready: boolean;
      message: string;
      stripeSessionStatus: string | null;
      stripePaymentStatus: string | null;
      userId: string | null;
      stripeSessionId?: string | null;
    } = {
      ready: false,
      message: 'Payment processing, finalizing shortly',
      stripeSessionStatus: null,
      stripePaymentStatus: null,
      userId: null,
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
      userId: doc.userId ? String(doc.userId) : null,
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



export default router;
