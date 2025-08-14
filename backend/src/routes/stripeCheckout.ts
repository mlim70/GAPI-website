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
import { finalizeCheckoutFromSession } from '../utils/accounts/finalizeCheckout';
import mongoose from 'mongoose';

// Import the authentication middleware from account routes
import { authenticateToken } from './account';

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
    // Validate Origin/Referer against allowlist
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    
    const allowedOrigins = [
      'https://gapi-website.vercel.app',
      'http://localhost:5173', // For development
      'http://localhost:3000'  // For development
    ];
    
    const isOriginAllowed = origin && allowedOrigins.some(allowed => 
      origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`)
    );
    
    const isRefererAllowed = referer && allowedOrigins.some(allowed => 
      referer.startsWith(allowed) || referer.includes(allowed.replace(/^https?:\/\//, ''))
    );
    
    if (!isOriginAllowed && !isRefererAllowed) {
      console.log('❌ CORS validation failed:', { origin, referer, allowedOrigins });
      return res.status(403).json({ message: 'Access denied' });
    }
    
    console.log('✅ CORS validation passed:', { origin, referer });
    
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
            const notPaid = stripeSession.payment_status !== 'paid';
            
            if (isOpen && notExpired && notPaid && stripeSession.url) {
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
                reason: !isOpen ? 'not open' : !notExpired ? 'expired' : !notPaid ? 'already paid' : 'no URL'
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
    await connectToDatabase();
    
    const { session_id } = req.query;
    
    if (!session_id) {
      console.log('❌ Missing session_id parameter');
      return res.status(400).json({ message: 'Session ID is required' });
    }

    console.log('🔍 Verifying session:', session_id);

    // Validate session ID format
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    // Retrieve the session from Stripe
    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id as string, {
          expand: ['subscription', 'line_items']
        });
      console.log('✅ Stripe session retrieved:', {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        metadata: session.metadata
      });
    } catch (err: any) {
      console.error('❌ Failed to retrieve Stripe session:', err.message);
      return res.status(400).json({ message: 'Invalid session ID or Stripe error' });
    }
    
    // Check if payment is completed or no payment required (free trials, $0 invoices)
    const paidOrComplete =
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required' ||
      session.status === 'complete';

    if (!paidOrComplete) {
      console.log('❌ Session not paid, complete, or no payment required:', { 
        payment_status: session.payment_status, 
        status: session.status 
      });
      return res.status(200).json({ 
        ready: false, 
        payment_status: session.payment_status,
        message: 'Payment not completed yet'
      });
    }

    // Get user ID from session metadata (could be pendingUserId for new users or userId for existing users)
    const { pendingUserId, userId } = session.metadata || {};
    console.log('🔍 Session metadata:', { pendingUserId, userId });
    
    if (!pendingUserId && !userId) {
      console.log('❌ No user ID found in session metadata');
      return res.status(400).json({ message: 'User ID not found in session' });
    }

    // Handle existing user changing plans
    if (userId) {
      console.log('🔍 Looking up existing user:', userId);
      const user = await User.findById(userId);
      if (user) {
        console.log('✅ Found existing user:', { id: user._id, email: user.email });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(200).json({
          ready: true,
          token, 
          user: {
            _id: user._id,
            email: user.email,
            username: user.username,
            name: user.name
          }
        });
      } else {
        console.log('❌ Existing user not found:', userId);
        return res.status(400).json({ message: 'User not found' });
      }
    }

    // Handle new user registration
    if (pendingUserId) {
      console.log('🔍 Processing new user registration for pendingUserId:', pendingUserId);
      
      // 1) First check if PendingUser is already marked as ready
      const pendingUser = await PendingUser.findById(pendingUserId);
      if (pendingUser?.ready) {
        console.log('✅ PendingUser already marked as ready');
        // Find the real user that was created
        const user = await User.findOne({ 
          $or: [{ email: pendingUser.email }, { username: pendingUser.username }] 
        });
        if (user) {
          const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
          return res.status(200).json({
            ready: true,
            token, 
            user: {
              _id: user._id,
              email: user.email,
              username: user.username,
              name: user.name
            }
          });
        }
      }

      // 2) If PendingUser exists but not ready, attempt fallback finalization
      if (pendingUser && !pendingUser.ready) {
        console.log('💰 Payment completed, attempting fallback finalization...');
        try {
          await finalizeCheckoutFromSession(session);
          
          // Check if finalization succeeded
          const after = await PendingUser.findById(pendingUserId);
          if (after?.ready) {
            console.log('✅ Fallback finalization completed');
            // Find the real user that was created
            const user = await User.findOne({ 
              $or: [{ email: pendingUser.email }, { username: pendingUser.username }] 
            });
            if (user) {
              const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
              return res.status(200).json({
                ready: true,
                token, 
                user: {
                  _id: user._id,
                  email: user.email,
                  username: user.username,
                  name: user.name
                }
              });
            }
          }
        } catch (finalizeError) {
          console.error('❌ Fallback finalization failed:', finalizeError);
          // Continue and return current status
        }
      }

            // 3) Check if CheckoutSession is completed (webhook has processed)
      const checkoutSession = await CheckoutSession.findOne({ 
        stripeSessionId: session_id,
        status: 'COMPLETED'
      });
      
      if (checkoutSession) {
        // PendingUser no longer exists, so webhook has processed
        // Find the real user by the email stored in the checkout session
        const user = await User.findOne({ 
          email: checkoutSession.pendingUserEmail 
        });
      
        if (user) {
          console.log('✅ Found user by email:', user.email);
          const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
          return res.status(200).json({
            ready: true,
            token, 
            user: {
              _id: user._id,
              email: user.email,
              username: user.username,
              name: user.name
            }
          });
        }
      }

      // 4) Still not ready - return false
      console.log('⏳ Session not ready yet');
      return res.status(200).json({ ready: false });
    }

  } catch (error) {
    console.error('❌ Error verifying session:', error);
    res.status(500).json({ message: 'Failed to verify session' });
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
