import { Router } from 'express';
import express from 'express';
import { stripe } from '../lib/stripe.js';
import Subscription from '../models/subscription.model.js';
import MembershipLevel from '../models/membershipLevel.model.js';
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import PendingUser from '../models/pendingUser.model.js';
import { syncMembershipLevels } from '../utils/syncStripeMemberships.js';
import Stripe from 'stripe';
const router = Router();

// Test endpoint to verify webhook route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Webhook route is working' });
});

// raw body required
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    
    let event;
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).send('Webhook secret not configured');
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'] as string,
        webhookSecret,
      );
          } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).send('Webhook signature verification failed');
      }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const s = event.data.object as Stripe.Checkout.Session;
          const { pendingUserId, levelKey } = s.metadata || {};
          
          if (!pendingUserId || !levelKey) {
            console.log('Skipping checkout.session.completed - missing metadata (likely test event)');
            break;
          }

          // Check for idempotency - if user already exists with this session ID, skip processing
          const existingUser = await User.findOne({ stripeSessionId: s.id });
          if (existingUser) {
            console.log('Skipping duplicate checkout.session.completed event');
            break;
          }

          const level = await MembershipLevel.findOne({ key: levelKey });
          if (!level) {
            console.error('Membership level not found:', levelKey);
            break;
          }

          // Find the pending user
          const pendingUser = await PendingUser.findById(pendingUserId);
          if (!pendingUser) {
            console.error('Pending user not found:', pendingUserId);
            break;
          }

          // Create the real user from pending user data
          const user = await User.create({
            email: pendingUser.email,
            username: pendingUser.username,
            passwordHash: pendingUser.passwordHash,
            name: pendingUser.name,
            role: 'subscriber',
            stripeSessionId: s.id // Store the session ID for verification
          });
          console.log('✅ Real user created:', user.email);

          // Create or update subscription
          try {
            const subscription = await Subscription.findOneAndUpdate(
              { gatewaySubId: s.subscription ?? s.payment_intent },
              {
                userId: user._id,
                levelId: level._id,
                gateway: 'stripe',
                gatewaySubId: s.subscription ?? s.payment_intent,
                status: 'ACTIVE',
                startDate: new Date(s.created * 1000),
                nextBillDate: s.subscription ? new Date((s.created + 30 * 24 * 60 * 60) * 1000) : undefined, // 30 days for recurring
              },
              { upsert: true, new: true },
            );
            console.log('✅ Subscription created/updated:', subscription._id);
          } catch (subscriptionError) {
            console.error('❌ Error creating subscription:', subscriptionError);
            // Continue with order creation and pending user deletion
          }
          
          // Create order record
          try {
            const order = await Order.create({
              userId: user._id,
              membershipLevelId: level._id,
              gatewayPaymentId: s.payment_intent ?? s.subscription ?? s.id,
              totalCents: s.amount_total!,
              currency: s.currency!.toLowerCase(),
              billing: {
                name: `${user.name.first} ${user.name.last}`,
                email: user.email,
              },
              status: 'COMPLETED',
              paidAt: new Date(s.created * 1000),
            });
            console.log('✅ Order created:', order._id);
          } catch (orderError) {
            console.error('❌ Error creating order:', orderError);
            // Continue with pending user deletion even if order creation fails
          }

          // Delete the pending user after successful payment
          try {
            const result = await PendingUser.findByIdAndDelete(pendingUserId);
            if (!result) {
              console.warn('⚠️ No PendingUser found for deletion:', pendingUserId);
            } else {
              console.log('🗑️ PendingUser deleted:', result._id);
            }
          } catch (deleteError) {
            console.error('❌ Error deleting pending user:', deleteError);
          }
          break;
        }

        case 'invoice.payment_failed':
        case 'customer.subscription.deleted':
          console.log('🔄 Processing subscription status update:', event.type);
          try {
            const result = await Subscription.findOneAndUpdate(
              { gatewaySubId: (event.data.object as any).id },
              { status: 'CANCELLED' },
              { new: true }
            );
            if (!result) {
              console.warn('⚠️ No Subscription found for gatewaySubId:', (event.data.object as any).id);
            } else {
              console.log('✅ Subscription updated:', result._id);
            }
          } catch (err) {
            console.error('❌ Error updating Subscription:', err);
          }
          break;
          
        case 'product.updated':
        case 'product.created':
        case 'price.updated':
        case 'price.created':
        case 'price.deleted':
          console.log('🔄 Syncing membership levels from Stripe...');
          await syncMembershipLevels();
          break;
          
        default:
          console.log('Unhandled webhook event type:', event.type);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
);

export default router;
