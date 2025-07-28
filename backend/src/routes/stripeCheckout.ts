import { Router } from 'express';
import { stripe } from '@lib/stripe.js';
import MembershipLevel from '@models/membershipLevel.model.js';
import User from '@models/user.model.js';
import PendingUser from '@models/pendingUser.model.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is missing');
}

const router = Router();

router.post('/', async (req, res) => {
  const { pendingUserId, levelKey, userId } = req.body;
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level?.stripePriceId) return res.status(404).send('Level not found');

  // Check if this is an existing user changing plans
  if (userId) {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Create checkout session for existing user
    const session = await stripe.checkout.sessions.create({
      mode: level.isRecurring ? 'subscription' : 'payment',
      line_items: [{ price: level.stripePriceId, quantity: 1 }],
      metadata: { userId, levelKey },
      client_reference_id: userId,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/cancel`,
      payment_method_types: ['card'],
    });

    return res.json({ sessionId: session.id });
  }

  // Handle new user registration
  if (!pendingUserId) {
    return res.status(400).send('Pending user ID is required for new registrations');
  }

  // Get pending user data for customer metadata
  const pendingUser = await PendingUser.findById(pendingUserId);
  if (!pendingUser) {
    return res.status(404).send('Pending user not found');
  }

  const session = await stripe.checkout.sessions.create({
    mode: level.isRecurring ? 'subscription' : 'payment',
    line_items: [{ price: level.stripePriceId, quantity: 1 }],
    metadata: { pendingUserId, levelKey },
    client_reference_id: pendingUserId, // Additional fraud signal
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/stripe/cancel`,
    payment_method_types: ['card'], // Only card payments
  });

  res.json({ sessionId: session.id });
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

      // 2) If no PendingUser, check if real User was created by webhook
      // The webhook creates the real User with the stripeSessionId field
      const user = await User.findOne({ stripeSessionId: session_id });
    
      if (user) {
        console.log(`✅ Found user by session ID: ${user.email}`);
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

      // 3) Neither pending nor real user found - still in progress
      console.log(`⏳ No PendingUser or recent User found for session: ${session_id}`);
      return res.status(200).json({ ready: false });
    }

  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});

export default router;
