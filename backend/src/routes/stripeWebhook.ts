import { Router } from 'express';
import express from 'express';
import { stripe } from '@lib/stripe.js';
import Subscription from '@models/subscription.model.js';
import MembershipLevel from '@models/membershipLevel.model.js';
import Order from '@models/order.model.js';
import User from '@models/user.model.js';
import PendingUser from '@models/pendingUser.model.js';
import WebhookEvent from '@models/webhookEvent.model.js';
import { syncSingleMembershipLevel } from '@utils/syncStripeMemberships.js';
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

    // Check if this event has already been processed
    try {
      const existingEvent = await WebhookEvent.findOne({ eventId: event.id });
      if (existingEvent) {
        console.log(`🔄 Event ${event.id} (${event.type}) already processed at ${existingEvent.processedAt}, skipping`);
        return res.status(200).json({ received: true, message: 'Event already processed' });
      }
    } catch (error) {
      console.error('❌ Error checking for existing event:', error);
      // Continue processing even if event tracking fails
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

          // STEP A: Get or create membership level
          const level = await MembershipLevel.findOne({ key: levelKey });
          if (!level) {
            console.error('Membership level not found:', levelKey);
            break;
          }

          // STEP B: Get or create user (step-level resume)
          let user = await User.findOne({ stripeSessionId: s.id });
          if (!user) {
            console.log('🔄 Creating new user...');
            const pendingUser = await PendingUser.findById(pendingUserId);
            if (!pendingUser) {
              console.error('Pending user not found:', pendingUserId);
              break;
            }

            user = await User.create({
              email: pendingUser.email,
              username: pendingUser.username,
              passwordHash: pendingUser.passwordHash,
              name: pendingUser.name,
              avatarUrl: pendingUser.avatarUrl,
              role: 'subscriber',
              stripeSessionId: s.id
            });
            console.log('✅ User created:', user.email);
          } else {
            console.log('🔄 Using existing user:', user.email);
          }

          // STEP C: Create or update subscription (resource-level upsert)
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
                nextBillDate: s.subscription ? new Date((s.created + 30 * 24 * 60 * 60) * 1000) : undefined,
              },
              { upsert: true, new: true }
            );
            console.log('✅ Subscription created/updated:', subscription._id);
          } catch (subscriptionError) {
            console.error('❌ Error creating subscription:', subscriptionError);
            // Continue with order creation
          }
          
          // STEP D: Create order record (resource-level upsert)
          try {
            const order = await Order.findOneAndUpdate(
              { gatewayPaymentId: s.payment_intent ?? s.subscription ?? s.id },
              {
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
              },
              { upsert: true, new: true }
            );
            console.log('✅ Order created/updated:', order._id);
          } catch (orderError) {
            console.error('❌ Error creating order:', orderError);
            // Continue with pending user deletion
          }

          // STEP E: Delete pending user (safe to re-run)
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
              { upsert: true, new: true }
            );
            console.log('✅ Subscription updated:', result._id);
          } catch (err) {
            console.error('❌ Error updating Subscription:', err);
          }
          break;
          
        case 'product.updated':
        case 'product.created':
        case 'price.updated':
        case 'price.created':
        case 'price.deleted':
          console.log('🔄 Syncing single membership level from webhook event...');
          await syncSingleMembershipLevel(event);
          break;
          
        default:
          console.log('Unhandled webhook event type:', event.type);
      }
      
      // Record successful event processing
      try {
        await WebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          status: 'processed',
        });
        console.log(`✅ Event ${event.id} (${event.type}) recorded as processed`);
      } catch (error) {
        console.error('❌ Error recording webhook event:', error);
        // Don't fail the webhook response if event tracking fails
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      // Record failed event processing
      try {
        await WebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log(`❌ Event ${event.id} (${event.type}) recorded as failed`);
      } catch (trackingError) {
        console.error('❌ Error recording failed webhook event:', trackingError);
      }
      
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
);

export default router;
