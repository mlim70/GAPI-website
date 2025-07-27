import { Router } from 'express';
import express from 'express';
import { stripe } from '../lib/stripe.js';
import Subscription from '../models/subscription.model.js';
import MembershipLevel from '../models/membershipLevel.model.js';
import Order from '../models/order.model.js';
import { syncMembershipLevels } from '../utils/syncStripeMemberships.js';
import Stripe from 'stripe';
const router = Router();

// raw body required!
router.post(
  '/',
  Router().use(express.raw({ type: 'application/json' })),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'] as string,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      return res.status(400).send('Webhook error');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const { userId, levelKey } = s.metadata!;
        const level = await MembershipLevel.findOne({ key: levelKey });
        
        await Subscription.findOneAndUpdate(
          { gatewaySubId: s.subscription ?? s.payment_intent },
          {
            userId,
            levelId: level!._id,
            gateway: 'stripe',
            gatewaySubId: s.subscription ?? '',
            status: 'ACTIVE',
            startDate: new Date(s.created * 1000),
          },
          { upsert: true },
        );
        
        await Order.create({
          membershipLevelId: level!._id,
          total: s.amount_total! / 100,
          currency: s.currency!.toUpperCase(),
          gatewayPaymentId: s.payment_intent ?? 'checkout',
          status: 'COMPLETED',
          paidAt: new Date(s.created * 1000),
        });
        break;
      }

      case 'invoice.payment_failed':
      case 'customer.subscription.deleted':
        await Subscription.findOneAndUpdate(
          { gatewaySubId: (event.data.object as any).id },
          { status: 'CANCELLED' },
        );
        break;
        
      case 'product.updated':
      case 'product.created':
      case 'price.updated':
      case 'price.created':
      case 'price.deleted':
        await syncMembershipLevels();
        break;
    }
    res.json({ received: true });
  },
);

export default router;
