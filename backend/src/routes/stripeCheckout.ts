import { Router } from 'express';
import { stripe } from '../lib/stripe';
import MembershipLevel from '../models/membershipLevel.model';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();

router.post('/', async (req, res) => {
  console.log('🛒 Starting checkout session creation...');
  const { pendingUserId, levelKey, userId } = req.body;
  console.log('📋 Request body:', { pendingUserId, levelKey, userId });

  if (!pendingUserId && !userId) {
    console.log('❌ Missing required parameters');
    return res.status(400).json({ message: 'pendingUserId or userId is required' });
  }

  // look up membership level
  console.log('🔍 Looking up membership level:', levelKey);
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level) {
    console.log('❌ Invalid membership level:', levelKey);
    return res.status(400).json({ message: 'Invalid levelKey' });
  }
  console.log('✅ Found membership level:', { id: level._id, key: level.key, priceId: level.stripePriceId });

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
      const session = await stripe.checkout.sessions.create({
        mode: level.isRecurring ? 'subscription' : 'payment',
        line_items: [{ price: level.stripePriceId, quantity: 1 }],
        metadata: {
          pendingUserId: pendingUser._id.toString(),
          levelKey,
        },
        client_reference_id: pendingUserId,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/cancel`,
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
      return res
        .status(500)
        .json({ message: 'Failed to create checkout session' });
    }
  } else if (userId) {
    // Handle existing-user flow (plan change)
    console.log('👤 Processing existing-user flow for userId:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(400).json({ message: 'User not found' });
    }
    console.log('✅ Found existing user:', { email: user.email, username: user.username });

    try {
      console.log('💳 Creating Stripe checkout session for existing user...');
      const session = await stripe.checkout.sessions.create({
        mode: level.isRecurring ? 'subscription' : 'payment',
        line_items: [{ price: level.stripePriceId, quantity: 1 }],
        metadata: {
          userId: user._id.toString(),
          levelKey,
        },
        client_reference_id: userId,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/cancel`,
        payment_method_types: ['card'],
      });
      console.log('✅ Created Stripe session for existing user:', { id: session.id, url: session.url });

      console.log('🎉 Existing user checkout session creation successful');
      return res.status(200).json({
        sessionUrl: session.url,
        sessionId: session.id,
      });
    } catch (err: any) {
      console.error('❌ Failed to create checkout session for existing user:', err);
      return res
        .status(500)
        .json({ message: 'Failed to create checkout session' });
    }
  }
});

// Verify session and return user authentication data
router.get('/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id as string);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Get user ID from session metadata (could be pendingUserId for new users or userId for existing users)
    const { pendingUserId, userId } = session.metadata || {};
    
    if (!pendingUserId && !userId) {
      return res.status(400).json({ message: 'User ID not found in session' });
    }

    // Handle existing user changing plans
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        console.log(`✅ Found existing user: ${user.email}`);
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(200).json({
          ready: true,
          token, 
          user: {
            _id: user._id,
            email: user.email,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role
          }
        });
      }
    }

    // Handle new user registration
    if (pendingUserId) {
      // 1) First check if PendingUser still exists (webhook hasn't processed yet)
      const pendingUser = await PendingUser.findById(pendingUserId);
      if (pendingUser) {
        console.log(`⏳ PendingUser still exists for ID: ${pendingUserId}`);
        return res.status(200).json({ ready: false });
      }

      // 2) Check if CheckoutSession is completed
      const checkoutSession = await CheckoutSession.findOne({ 
        stripeSessionId: session_id,
        status: 'COMPLETED'
      });
      
      if (!checkoutSession) {
        console.log(`⏳ CheckoutSession not completed for session: ${session_id}`);
        return res.status(200).json({ ready: false });
      }

      // 3) If CheckoutSession is completed, find the user by the pending user's email
      const pendingUserLookup = await PendingUser.findById(checkoutSession.pendingUserId);
      if (pendingUserLookup) {
        // PendingUser still exists, webhook hasn't processed yet
        console.log(`⏳ PendingUser still exists, webhook not processed yet`);
        return res.status(200).json({ ready: false });
      }
      
      // PendingUser no longer exists, so webhook has processed
      // Find the real user by the email stored in the checkout session
      const user = await User.findOne({ 
        email: checkoutSession.pendingUserEmail 
      });
    
      if (user) {
        console.log(`✅ Found user by email: ${user.email}`);
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(200).json({
          ready: true,
          token, 
          user: {
            _id: user._id,
            email: user.email,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role
          }
        });
      }

      // 4) Neither pending nor real user found - still in progress
      console.log(`⏳ No PendingUser or recent User found for session: ${session_id}`);
      return res.status(200).json({ ready: false });
    }

  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});

// Verify checkout session by internal ID with detailed status
router.get('/verify/:checkoutSessionId', async (req, res) => {
  try {
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
    if (!checkoutSession.stripeSessionId.startsWith('cs_')) {
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

export default router;
