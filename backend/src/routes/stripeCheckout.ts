import { Router } from 'express';
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
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';
import mongoose from 'mongoose';

// Import the authentication middleware from account routes
import { authenticateToken } from './account';

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();

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

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Checkout route is working!' });
});

router.post('/', 
  createRateLimiter(50, 15 * 60 * 1000), // 50 checkout sessions per 15 minutes per IP (prevent abuse)
  async (req, res) => {
  try {
    await connectToDatabase();
    
    console.log('🛒 Starting checkout session creation...');
    console.log('🔧 Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL
    });
    
    const { pendingUserId, levelKey, userId, recaptchaToken } = req.body;
    console.log('📋 Request body:', { pendingUserId, levelKey, userId });

  if (!pendingUserId && !userId) {
    console.log('❌ Missing required parameters');
    return res.status(400).json({ message: 'pendingUserId or userId is required' });
  }

  // reCAPTCHA verification for checkout
  if (!recaptchaToken) {
    console.log('❌ Missing reCAPTCHA token');
    return res.status(400).json({ message: 'Security verification required. Please refresh the page and try again.' });
  }

  console.log('🔍 Verifying reCAPTCHA token for checkout...');
  const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
  
  if (!recaptchaResult.success) {
    console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
    return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
  }

  // Log the action received from reCAPTCHA
  console.log('🔍 reCAPTCHA action received:', recaptchaResult.action);
  
  // Validate that the action matches 'checkout'
  if (recaptchaResult.action !== RECAPTCHA_CONFIG.EXPECTED_ACTIONS.CHECKOUT) {
    console.log('❌ reCAPTCHA action mismatch. Expected: checkout, Received:', recaptchaResult.action);
    return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
  }
  
  // Check if score is acceptable for checkout
  const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'checkout', RECAPTCHA_CONFIG.THRESHOLDS.CHECKOUT);
  if (!isScoreAcceptable) {
    console.log('❌ reCAPTCHA score too low for checkout:', recaptchaResult.score);
    return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
  }

  console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);

  // look up membership level
  console.log('🔍 Looking up membership level:', levelKey);
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level) {
    console.log('❌ Invalid membership level:', levelKey);
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
  
  // Log Stripe configuration for debugging
  console.log('🔧 About to call getBaseUrl()...');
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
    console.log('🔧 getBaseUrl() returned:', baseUrl);
  } catch (error) {
    console.error('❌ Error calling getBaseUrl():', error);
    throw error;
  }
  
  console.log('🔧 Stripe configuration check:', {
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) + '...',
    baseUrl
  });
  
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
  const isPriceValid = await validateStripePrice(level.stripePriceId);
  if (!isPriceValid) {
    console.log('❌ Stripe price is invalid or inactive:', level.stripePriceId);
    return res.status(400).json({ message: 'Selected membership level is not available' });
  }

  // Handle new-user flow
  if (pendingUserId) {
    console.log('👤 Processing new-user flow for pendingUserId:', pendingUserId);
    const pendingUser = await PendingUser.findById(pendingUserId);
    if (!pendingUser) {
      console.log('❌ Pending user not found:', pendingUserId);
      return res.status(400).json({ message: 'Pending user not found or expired' });
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

    // Check for existing checkout session with real Stripe ID
    console.log('🔍 Checking for existing checkout session...');
    const existing = await CheckoutSession.findOne({ pendingUserId: pendingUser._id });
    if (existing && existing.stripeSessionId && existing.stripeSessionId.startsWith('cs_')) {
      console.log('🔄 Found existing checkout session:', { id: existing._id, stripeSessionId: existing.stripeSessionId });
      // only if stripeSessionId is an actual Stripe session
      try {
        console.log('🔄 Retrieving existing Stripe session...');
        const stripeSession = await stripe.checkout.sessions.retrieve(existing.stripeSessionId);
        console.log('✅ Retrieved existing Stripe session:', { id: stripeSession.id, status: stripeSession.status });
        return res.status(200).json({
          sessionUrl: stripeSession.url,
          sessionId: stripeSession.id,
        });
      } catch (retrieveError) {
        // If retrieval fails, fall through to create a fresh session
        console.warn('⚠️ Failed to retrieve existing session, creating new one:', retrieveError);
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
      
      const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/stripe/cancel`;
      
      console.log('🔧 Generated URLs:', { successUrl, cancelUrl });
      
      const session = await stripe.checkout.sessions.create({
        mode: level.isRecurring ? 'subscription' : 'payment',
        line_items: [{ price: level.stripePriceId, quantity: 1 }],
        metadata: {
          pendingUserId: pendingUser._id.toString(),
          levelKey,
        },
        client_reference_id: pendingUserId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ['card'],
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
      
      const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/stripe/cancel`;
      
      console.log('🔧 Generated URLs for plan change:', { successUrl, cancelUrl });
      
      const session = await stripe.checkout.sessions.create({
        mode: level.isRecurring ? 'subscription' : 'payment',
        line_items: [{ price: level.stripePriceId, quantity: 1 }],
        metadata: {
          userId: user._id.toString(),
          levelKey,
        },
        client_reference_id: userId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ['card'],
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

    // Retrieve the session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id as string);
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
    
    if (session.payment_status !== 'paid') {
      console.log('❌ Session not paid:', session.payment_status);
      return res.status(400).json({ message: 'Payment not completed' });
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
      
      // 1) First check if PendingUser still exists (webhook hasn't processed yet)
      const pendingUser = await PendingUser.findById(pendingUserId);
      if (pendingUser) {
        console.log('⏳ PendingUser still exists, webhook not processed yet');
        return res.status(200).json({ ready: false });
      }

      // 2) Check if CheckoutSession is completed
      const checkoutSession = await CheckoutSession.findOne({ 
        stripeSessionId: session_id,
        status: 'COMPLETED'
      });
      
      if (!checkoutSession) {
        console.log('⏳ CheckoutSession not completed for session:', session_id);
        return res.status(200).json({ ready: false });
      }

      // 3) If CheckoutSession is completed, find the user by the pending user's email
      const pendingUserLookup = await PendingUser.findById(checkoutSession.pendingUserId);
      if (pendingUserLookup) {
        // PendingUser still exists, webhook hasn't processed yet
        console.log('⏳ PendingUser still exists, webhook not processed yet');
        return res.status(200).json({ ready: false });
      }
      
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

      // 4) Neither pending nor real user found - still in progress
      console.log('⏳ No PendingUser or recent User found for session:', session_id);
      return res.status(200).json({ ready: false });
    }

  } catch (error) {
    console.error('❌ Error verifying session:', error);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});

// Verify checkout session by internal ID with detailed status
router.get('/verify/:checkoutSessionId', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { checkoutSessionId } = req.params;
    
    if (!checkoutSessionId) {
      return res.status(400).json({ message: 'Checkout session ID is required' });
    }

    // Try to find the checkout session by MongoDB ID first
    let checkoutSession = await CheckoutSession.findById(checkoutSessionId);
    
    // If not found by MongoDB ID, try to find by Stripe session ID
    if (!checkoutSession) {
      checkoutSession = await CheckoutSession.findOne({ stripeSessionId: checkoutSessionId });
    }
    
    if (!checkoutSession) {
      return res.status(404).json({ 
        message: 'Checkout session not found',
        status: 'NOT_FOUND'
      });
    }

    // If no Stripe session ID, it's still pending
    if (!checkoutSession.stripeSessionId) {
      return res.status(200).json({ 
        message: 'Checkout session is pending',
        status: 'PENDING'
      });
    }

    // Validate Stripe session ID format
    if (!checkoutSession.stripeSessionId || !checkoutSession.stripeSessionId.startsWith('cs_')) {
      return res.status(400).json({ 
        message: 'Invalid Stripe session ID format',
        status: 'INVALID_FORMAT'
      });
    }

    try {
      // Retrieve the session from Stripe
      const stripeSession = await stripe.checkout.sessions.retrieve(checkoutSession.stripeSessionId);
      
      // Check payment status - only return COMPLETED for paid, everything else is PENDING
      if (stripeSession.payment_status === 'paid') {
        return res.status(200).json({ 
          message: 'Payment completed successfully',
          status: 'COMPLETED',
          stripeSessionId: stripeSession.id,
          paymentStatus: stripeSession.payment_status
        });
      } else {
        // All other payment statuses (unpaid, pending, no_payment_required, etc.) are considered PENDING
        return res.status(200).json({ 
          message: 'Payment not completed',
          status: 'PENDING',
          stripeSessionId: stripeSession.id,
          paymentStatus: stripeSession.payment_status
        });
      }
    } catch (stripeError) {
      console.error('Error retrieving Stripe session:', stripeError);
      return res.status(500).json({ 
        message: 'Failed to retrieve Stripe session',
        status: 'STRIPE_ERROR'
      });
    }

  } catch (error) {
    console.error('Error verifying checkout session:', error);
    res.status(500).json({ 
      message: 'Failed to verify checkout session',
      status: 'INTERNAL_ERROR'
    });
  }
});

// Debug endpoint to check Stripe configuration and membership levels
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

// Debug endpoint for session verification
router.get('/debug-session/:sessionId', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { sessionId } = req.params;
    console.log('🔍 Debug session endpoint called for:', sessionId);
    
    if (!sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }
    
    // Get Stripe session
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('✅ Stripe session retrieved:', {
        id: stripeSession.id,
        status: stripeSession.status,
        payment_status: stripeSession.payment_status,
        metadata: stripeSession.metadata
      });
    } catch (err: any) {
      console.error('❌ Failed to retrieve Stripe session:', err.message);
      return res.status(400).json({ error: 'Failed to retrieve Stripe session', details: err.message });
    }
    
    // Check database records
    const { pendingUserId, userId } = stripeSession.metadata || {};
    
    let pendingUser = null;
    let user = null;
    let checkoutSession = null;
    
    if (pendingUserId) {
      pendingUser = await PendingUser.findById(pendingUserId);
      console.log('🔍 PendingUser lookup:', pendingUser ? 'found' : 'not found');
    }
    
    if (userId) {
      user = await User.findById(userId);
      console.log('🔍 User lookup:', user ? 'found' : 'not found');
    }
    
    checkoutSession = await CheckoutSession.findOne({ stripeSessionId: sessionId });
    console.log('🔍 CheckoutSession lookup:', checkoutSession ? 'found' : 'not found');
    
    res.json({
      timestamp: new Date().toISOString(),
      sessionId,
      stripe: {
        id: stripeSession.id,
        status: stripeSession.status,
        payment_status: stripeSession.payment_status,
        metadata: stripeSession.metadata
      },
      database: {
        pendingUser: pendingUser ? { id: pendingUser._id, email: pendingUser.email } : null,
        user: user ? { id: user._id, email: user.email, membershipLevel: user.membershipLevel } : null,
        checkoutSession: checkoutSession ? { id: checkoutSession._id, status: checkoutSession.status } : null
      },
      analysis: {
        isReady: !pendingUser && (user || checkoutSession?.status === 'COMPLETED'),
        reason: pendingUser ? 'PendingUser still exists (webhook not processed)' : 
                !user && !checkoutSession ? 'No database records found' :
                'Ready for authentication'
      }
    });
  } catch (error) {
    console.error('❌ Debug session endpoint error:', error);
    res.status(500).json({ 
      error: 'Debug session endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
