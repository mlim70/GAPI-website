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
    
    try {
      await connectToDatabase();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
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
          
          // If webhook didn't run yet, do a heavy, idempotent fallback here
          if (after?.ready) {
            console.log('✅ Fallback finalization completed, now doing heavy fallback...');
            
            // 1) Find-or-create the real user
            let user = await User.findOne({ 
              $or: [{ email: after.email }, { username: after.username }] 
            });

            if (!user) {
              console.log('👤 Creating new user from pending user...');
              user = await User.create({
                email: after.email,
                username: after.username,
                passwordHash: after.passwordHash,
                name: after.name,
                membershipLevel: after.levelKey,
                emailVerified: true,
                verifiedAt: new Date()
              });
              console.log('✅ Created new user:', { id: user._id, email: user.email });
            } else {
              console.log('✅ Found existing user:', { id: user._id, email: user.email });
            }

            // 2) Resolve membership level
            const level = await MembershipLevel.findOne({ key: after.levelKey });
            if (!level) {
              console.error('❌ Invalid membership level:', after.levelKey);
              return res.status(400).json({ message: 'Invalid membership level' });
            }
            console.log('✅ Found membership level:', { id: level._id, key: level.key });

            // 3) Determine subscription kind
            const isRecurring = !!session.subscription;
            const isFree = (session.amount_total ?? 0) === 0 || session.payment_status === 'no_payment_required';
            const kind: 'ONE_TIME' | 'RECURRING' | 'FREE' = isRecurring ? 'RECURRING' : (isFree ? 'FREE' : 'ONE_TIME');
            const gateway: 'stripe' | 'internal' = isFree ? 'internal' : 'stripe';

            console.log('🔍 Subscription details:', { isRecurring, isFree, kind, gateway });

            // 4) Cancel other ACTIVE memberships (keep invariants)
            await Subscription.updateMany(
              { userId: user._id, status: 'ACTIVE' },
              { $set: { status: 'CANCELLED', endDate: new Date() } }
            );
            console.log('✅ Cancelled other active subscriptions');

            // 5) Upsert/create subscription
            let nextBillDate: Date | null = null;
            if (isRecurring && typeof session.subscription === 'string') {
              try {
                const stripeSub = await stripe.subscriptions.retrieve(session.subscription, { expand: ['latest_invoice'] });
                nextBillDate = new Date(stripeSub.current_period_end * 1000);
                console.log('📅 Next bill date from Stripe:', nextBillDate);
              } catch (e) {
                console.warn('⚠️ Could not fetch subscription for nextBillDate:', e);
              }
            }

            let subscription;
            if (isRecurring && typeof session.subscription === 'string') {
              // Upsert by gatewaySubId (idempotent if webhook races)
              subscription = await Subscription.findOneAndUpdate(
                { gatewaySubId: session.subscription },
                {
                  $set: {
                    userId: user._id,
                    levelId: level._id,
                    kind: 'RECURRING',
                    autoRenews: true,
                    gateway: 'stripe',
                    status: 'ACTIVE',
                    startDate: new Date(),
                    nextBillDate,
                    endDate: null,
                    cancelDate: null
                  }
                },
                { upsert: true, new: true }
              );
              console.log('✅ Upserted recurring subscription:', { id: subscription._id, gatewaySubId: subscription.gatewaySubId });
            } else {
              subscription = await Subscription.create({
                userId: user._id,
                levelId: level._id,
                kind,
                autoRenews: false,
                gateway,
                gatewaySubId: null,
                status: 'ACTIVE',
                startDate: new Date(),
                nextBillDate: null,
                endDate: null,
                cancelDate: null
              });
              console.log('✅ Created subscription:', { id: subscription._id, kind, gateway });
            }

            // 6) Upsert order (idempotent by gatewayPaymentId)
            let gatewayPaymentId: string =
              (session.payment_intent as string) ||
              (session.subscription as string) ||
              session.id;

            if (kind === 'FREE') gatewayPaymentId = `free_${subscription._id}`;

            const orderResult = await Order.updateOne(
              { gatewayPaymentId },
              {
                $setOnInsert: {
                  userId: user._id,
                  subscriptionId: subscription._id,
                  membershipLevelId: level._id,
                  totalCents: session.amount_total || 0,
                  currency: session.currency || 'usd',
                  billing: {
                    name: user.name?.first
                      ? `${user.name.first} ${user.name.last ?? ''}`.trim()
                      : user.username || user.email,
                    email: user.email,
                  },
                  status: 'COMPLETED',
                  paidAt: new Date()
                }
              },
              { upsert: true }
            );
            console.log('✅ Upserted order:', { gatewayPaymentId, upserted: orderResult.upsertedCount > 0 });

            // 7) Update user fast-cache + mark checkout session complete
            await User.findByIdAndUpdate(user._id, { membershipLevel: level.key });
            await CheckoutSession.findOneAndUpdate(
              { stripeSessionId: session.id },
              { status: 'COMPLETED' }
            );
            console.log('✅ Updated user membership level and checkout session');

            // 8) Cleanup pending user (safe even if webhook races)
            await PendingUser.findByIdAndDelete(after._id);
            console.log('✅ Cleaned up pending user');

            // 9) Issue token and finish
            const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
            console.log('🎉 Heavy fallback completed successfully, returning user data');
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
        } catch (finalizeError) {
          console.error('❌ Fallback finalization failed:', finalizeError);
          // Continue and return current status
        }
      }

      // 3) Check if CheckoutSession is completed (webhook has processed)
      console.log('🔍 Checking if CheckoutSession is completed...');
      const checkoutSession = await CheckoutSession.findOne({ 
        stripeSessionId: session_id,
        status: 'COMPLETED'
      });
      
      if (checkoutSession) {
        console.log('✅ Found completed CheckoutSession:', checkoutSession);
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
        } else {
          console.log('❌ User not found by email from checkout session:', checkoutSession.pendingUserEmail);
        }
      } else {
        console.log('⏳ CheckoutSession not completed yet, status:', checkoutSession?.status || 'not found');
      }

      // 4) Still not ready - return false
      console.log('⏳ Session not ready yet');
      return res.status(200).json({ 
        ready: false,
        message: 'Payment processing, please wait for webhook to complete',
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
        pendingUserId,
        checkoutSessionStatus: checkoutSession?.status || 'not found'
      });
    }

  } catch (error) {
    console.error('❌ Error verifying session:', error);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});



/**
 * GET /api/stripe/checkout/payment-status?sessionId=cs_...&pendingUserId=...
 * Returns { ready, sessionStatus, paymentStatus, pendingUserId, ... }
 * This is a simple endpoint that reads the fields set by the webhook
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
      message: 'Payment processing, please wait for webhook to complete',
      sessionStatus: null as string | null,
      paymentStatus: null as string | null,
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
      sessionStatus: doc.sessionStatus,
      paymentStatus: doc.paymentStatus
    });

    const isReady =
      doc.ready === true ||
      doc.status === 'READY' ||
      doc.status === 'COMPLETED';

    response = {
      ...response,
      ready: isReady,
      sessionStatus: doc.sessionStatus ?? null,
      paymentStatus: doc.paymentStatus ?? null,
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
      email: doc.pendingUserEmail ?? null,
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
