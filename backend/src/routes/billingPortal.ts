import { Router } from 'express';
import { stripe } from '../lib/stripe';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import jwt from 'jsonwebtoken';
import { getFrontendUrl } from '../config/urls';

const router = Router();

// Helper: ensure Stripe customer
async function ensureStripeCustomer(user: any) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user._id.toString() },
    name: user.name?.first ? `${user.name.first} ${user.name.last ?? ''}`.trim() : user.username
  });
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

// POST /api/billing/portal-session
router.post('/portal-session', async (req, res) => {
  try {
    await connectToDatabase();

    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted) return res.status(404).json({ message: 'User not found' });

    const customerId = await ensureStripeCustomer(user);

    // Debug: Check if user has active subscription
    const existingSubscription = await Subscription.findOne({ 
      userId: user._id, 
      status: 'ACTIVE' 
    });
    
    console.log('🔍 Billing Portal Debug:', {
      userId: user._id,
      customerId,
      hasActiveSubscription: !!existingSubscription,
      subscriptionDetails: existingSubscription ? {
        id: existingSubscription._id,
        gatewaySubId: existingSubscription.gatewaySubId,
        levelId: existingSubscription.levelId,
        status: existingSubscription.status
      } : null
    });

    const returnUrl = `${getFrontendUrl()}/auth/account`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    console.error('Portal session error:', e);
    res.status(500).json({ message: 'Failed to create billing portal session' });
  }
});

export default router;
