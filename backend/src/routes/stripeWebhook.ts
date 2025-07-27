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
    console.log('🔔 Webhook received:', req.headers['stripe-signature'] ? 'with signature' : 'without signature');
    console.log('📋 Request body type:', typeof req.body);
    console.log('📋 Request body is Buffer:', Buffer.isBuffer(req.body));
    console.log('📋 Request body length:', req.body?.length);
    console.log('📋 Content-Type:', req.headers['content-type']);
    
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
      console.log('✅ Webhook signature verified, event type:', event.type);
      console.log('📋 Event ID:', event.id);
      console.log('📋 Event created:', new Date(event.created * 1000));
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return res.status(400).send('Webhook signature verification failed');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          console.log('💰 Processing checkout.session.completed...');
          const s = event.data.object as Stripe.Checkout.Session;
          console.log('📋 Full session metadata:', JSON.stringify(s.metadata, null, 2));
          console.log('📋 Session payment status:', s.payment_status);
          console.log('📋 Session mode:', s.mode);
          console.log('📋 Session subscription:', s.subscription);
          console.log('📋 Session payment intent:', s.payment_intent);
          
          const { pendingUserId, levelKey } = s.metadata || {};
          console.log('📋 Extracted metadata:', { pendingUserId, levelKey });
          
          if (!pendingUserId || !levelKey) {
            console.error('❌ Missing metadata in session:', s.metadata);
            break;
          }

          const level = await MembershipLevel.findOne({ key: levelKey });
          if (!level) {
            console.error('❌ Membership level not found:', levelKey);
            break;
          }

          // Find the pending user
          const pendingUser = await PendingUser.findById(pendingUserId);
          if (!pendingUser) {
            console.error('❌ Pending user not found:', pendingUserId);
            break;
          }

          console.log('👤 Creating real user from pending user:', pendingUser.email);
          console.log('📧 PendingUser email:', pendingUser.email);
          console.log('📧 Session customer_details email:', s.customer_details?.email);

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
              gatewayPaymentId: s.payment_intent ?? s.id,
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
            const deleteResult = await PendingUser.findByIdAndDelete(pendingUserId);
            if (deleteResult) {
              console.log('🗑️ Pending user deleted:', pendingUserId);
            } else {
              console.log('⚠️ Pending user not found for deletion:', pendingUserId);
            }
          } catch (deleteError) {
            console.error('❌ Error deleting pending user:', deleteError);
          }
          break;
        }

        case 'invoice.payment_failed':
        case 'customer.subscription.deleted':
          console.log('🔄 Processing subscription status update:', event.type);
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
          console.log('🔄 Syncing membership levels from Stripe...');
          await syncMembershipLevels();
          break;
          
        default:
          console.log('ℹ️ Unhandled webhook event type:', event.type);
          console.log('📋 Event data:', JSON.stringify(event.data, null, 2));
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
);

export default router;
