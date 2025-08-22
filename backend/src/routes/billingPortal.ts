import express, { Router, Request, Response } from 'express';
import { stripe } from '../lib/stripe';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { getFrontendUrl } from '../config/urls';
import { requireAuth } from '../middleware/requireAuth';
import { ensureStripeCustomer } from '../utils/stripeCustomer';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/billing/portal-session
router.post('/portal-session', requireAuth, async (req: Request, res: Response) => {
  try {
    await connectToDatabase();

    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Account not yet activated. Please complete your membership registration first.' });
    }

    const customerId = await ensureStripeCustomer(user);

    // Debug: Check if user has active subscription
    const existingSubscription = await Subscription.findOne({ 
      userId: user._id, 
      status: 'ACTIVE' 
    });
    
    logger.debug('Billing Portal Debug:', {
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

    const returnUrl = `${getFrontendUrl()}/auth/account?fromStripe=true`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    logger.error('Portal session error:', e);
    res.status(500).json({ message: 'Failed to create billing portal session' });
  }
});

export default router;
