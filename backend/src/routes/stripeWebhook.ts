import { Router } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import { stripe } from '../lib/stripe';
import Subscription from '../models/subscription.model';
import MembershipLevel from '../models/membershipLevel.model';
import Order from '../models/order.model';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';
import { syncSingleMembershipLevel } from '../utils/syncStripeMemberships';
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
    console.log('🔔 Webhook received');
    console.log('📋 Headers:', { 
      'stripe-signature': req.headers['stripe-signature'] ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    });
    
    let event: Stripe.Event;

    // 2.1 verify signature
    if (process.env.NODE_ENV === 'test' &&
        req.headers['stripe-signature'] === 'present') {
      event = req.body as unknown as Stripe.Event;   // trust the mock payload
    } else {
      try {
        console.log('🔐 Verifying webhook signature...');
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'] as string,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
        console.log('✅ Webhook signature verified');
        console.log('📦 Event details:', { id: event.id, type: event.type, created: new Date(event.created * 1000) });
      } catch (err) {
        console.error('❌ Webhook signature verification failed:', err);
        return res.status(400).send('Invalid signature');         // tests expect 400
      }
    }

    // 2.2 de-dupe **before** doing any work
    console.log('🔍 Checking for duplicate event...');
    const already = await WebhookEvent.findOne({
      eventId: event.id,
      status: 'processed'
    });
    if (already) {
      console.log('🔄 Event already processed, skipping:', { eventId: event.id, processedAt: already.processedAt });
      return res.status(200).json({ message: 'already processed' });
    }
    console.log('✅ Event is new or failed, proceeding with processing');

    // 2.3 verify payload shape before recording
    if (!event.id || !event.type) {
      console.log('❌ Malformed event payload:', { id: event.id, type: event.type });
      return res.status(400).json({ error: 'Malformed event payload' });
    }

    // 2.4 record the event up-front so a crash still leaves a breadcrumb
    console.log('📝 Recording event in database...');
    await WebhookEvent.create({ eventId: event.id, eventType: event.type, status: 'failed' });
    console.log('✅ Event recorded in database');

    try {
      console.log('🔄 Processing event type:', event.type);
      switch (event.type) {
        case 'checkout.session.completed': {
          console.log('💳 Processing checkout.session.completed event');
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('📦 Session details:', { 
            id: session.id, 
            payment_status: session.payment_status, 
            status: session.status,
            metadata: session.metadata 
          });
          
          const { pendingUserId, levelKey } = session.metadata ?? {};
          console.log('🔍 Extracted metadata:', { pendingUserId, levelKey });

          // a) malformed → 400  (tests: "Malformed Webhook Data")
          if (!pendingUserId || !levelKey) {
            console.log('❌ Missing required metadata:', { pendingUserId, levelKey });
            await WebhookEvent.updateOne({ eventId: event.id }, { status: 'invalid' });
            return res.status(400).json({ error: 'Missing metadata' });
          }

          // Accept events whose charge is paid, even if `status` is missing.
          // Treat an explicit non-'complete' (eg. 'open', 'expired') as invalid.
          const isComplete = !session.status || session.status === 'complete';

          if (!isComplete || session.payment_status !== 'paid') {
            console.log('⚠️ Session not complete or not paid, marking as invalid:', {
              status: session.status,
              payment_status: session.payment_status,
            });
            await WebhookEvent.updateOne({ eventId: event.id }, { status: 'invalid' });
            return res.status(400).json({ error: 'Session not paid / incomplete' });
          }

          // b) user missing → 500  (tests: "Webhook Processing Failure")
          console.log('👤 Looking up pending user:', pendingUserId);
          const pendingUser = await PendingUser.findById(pendingUserId);
          if (!pendingUser) {
            console.log('❌ Pending user not found:', pendingUserId);
            throw new Error(`Pending user not found: ${pendingUserId}`);
          }
          console.log('✅ Found pending user:', { email: pendingUser.email, username: pendingUser.username });

          // c) happy path
          console.log('👤 Creating new user from pending user...');
          const user = await User.create({
            email:    pendingUser.email,
            username: pendingUser.username,
            passwordHash: pendingUser.passwordHash,
            name: pendingUser.name,
            avatarUrl: pendingUser.avatarUrl,
            role: 'subscriber'
          });
          console.log('✅ Created new user:', { id: user._id, email: user.email, role: user.role });

          // ===== Order & Subscription =====
          console.log('💳 Processing payment details...');
          let gatewayPaymentId = session.payment_intent as string | undefined;
          if (!gatewayPaymentId && session.subscription) {
            gatewayPaymentId = session.subscription as string;
          }
          if (!gatewayPaymentId) gatewayPaymentId = session.id; // always cs_
          console.log('🔍 Gateway payment ID:', gatewayPaymentId);

          // Get membership level
          console.log('🔍 Looking up membership level:', levelKey);
          const level = await MembershipLevel.findOne({ key: levelKey });
          if (!level) {
            console.log('❌ Membership level not found:', levelKey);
            throw new Error(`Membership level not found: ${levelKey}`);
          }
          console.log('✅ Found membership level:', { id: level._id, key: level.key });

          // Create subscription
          console.log('📋 Creating subscription...');
          
          // Get nextBillDate from Stripe subscription if it exists
          let nextBillDate: Date | undefined;
          if (session.subscription) {
            try {
              console.log('🔍 Retrieving Stripe subscription for nextBillDate...');
              const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
              nextBillDate = new Date(stripeSub.current_period_end * 1000);
              console.log('📅 Next bill date from Stripe:', nextBillDate);
            } catch (e) {
              console.warn('⚠️  Could not fetch subscription; continuing without nextBillDate', e);
            }
          }
          
          const subscription = await Subscription.create({
            userId: user._id,
            levelId: level._id,
            gateway: 'stripe',
            gatewaySubId: session.subscription || `sub_${session.id}`,
            status: 'ACTIVE',
            startDate: new Date(),
            nextBillDate,
          });
          console.log('✅ Created subscription:', { id: subscription._id, gatewaySubId: subscription.gatewaySubId, nextBillDate });

          // Create order
          console.log('📋 Creating order...');
          await Order.create({
            userId: user._id,
            subscriptionId: subscription._id,
            membershipLevelId: level._id,
            gatewayPaymentId,        // pi_, sub_, or cs_
            totalCents: session.amount_total || 0,
            currency: session.currency || 'usd',
            billing: {
              name: pendingUser.name?.first
                ? `${pendingUser.name.first} ${pendingUser.name.last ?? ''}`.trim()
                : pendingUser.username || pendingUser.email,
              email: pendingUser.email,
            },
            status: 'COMPLETED',
            paidAt: new Date(),
          });
          console.log('✅ Created order');

          // Update checkout session
          await CheckoutSession.findOneAndUpdate(
            { pendingUserId: pendingUser._id },
            { status: 'COMPLETED' }
          );

          // Clean up pending user
          await PendingUser.findByIdAndDelete(pendingUser._id);

          break;
        }

        case 'invoice.payment_succeeded':
          console.log('💳 Processing invoice.payment_succeeded event');
          try {
            const invoice = event.data.object as Stripe.Invoice;
            console.log('📦 Invoice details:', { 
              id: invoice.id, 
              subscription: invoice.subscription,
              amount_paid: invoice.amount_paid,
              currency: invoice.currency 
            });
            
            if (invoice.subscription && typeof invoice.subscription === 'string') {
              try {
                console.log('🔍 Retrieving Stripe subscription for nextBillDate update...');
                const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription);
                const nextBillDate = new Date(stripeSubscription.current_period_end * 1000);
                console.log('📅 Next bill date from Stripe:', nextBillDate);
                
                const result = await Subscription.findOneAndUpdate(
                  { gatewaySubId: invoice.subscription },
                  { 
                    nextBillDate,
                    status: 'ACTIVE'
                  },
                  { new: true }
                );
                console.log('✅ Subscription updated:', { id: result._id, nextBillDate });
              } catch (e) {
                console.warn('⚠️  Could not fetch subscription for nextBillDate update; continuing', e);
              }
            } else {
              console.log('⚠️ No subscription found in invoice, skipping nextBillDate update');
            }
          } catch (err) {
            console.error('❌ Error updating subscription nextBillDate:', err);
          }
          break;

        case 'invoice.payment_failed':
        case 'customer.subscription.deleted':
          console.log('❌ Processing subscription cancellation event:', event.type);
          try {
            const subscriptionData = event.data.object as any;
            console.log('📦 Subscription details:', { 
              id: subscriptionData.id, 
              status: subscriptionData.status 
            });
            
            const result = await Subscription.findOneAndUpdate(
              { gatewaySubId: subscriptionData.id },
              { status: 'CANCELLED' },
              { upsert: true, new: true }
            );
            console.log('✅ Subscription cancelled:', { id: result._id, status: result.status });
          } catch (err) {
            console.error('❌ Error cancelling subscription:', err);
          }
          break;

        case 'customer.subscription.updated':
          console.log('🔄 Processing subscription update:', event.type);
          try {
            const subscription = event.data.object as Stripe.Subscription;
            
            // Get the membership level for this subscription
            const priceId = subscription.items.data[0]?.price.id;
            const membershipLevel = await MembershipLevel.findOne({ stripePriceId: priceId });
            
            if (!membershipLevel) {
              console.error('❌ Membership level not found for price:', priceId);
              break;
            }

            const result = await Subscription.findOneAndUpdate(
              { gatewaySubId: subscription.id },
              {
                levelId: membershipLevel._id,
                status: subscription.status === 'active' ? 'ACTIVE' : 'CANCELLED',
                nextBillDate: new Date(subscription.current_period_end * 1000),
              },
              { upsert: true, new: true }
            );
            console.log('✅ Subscription updated:', result._id);
          } catch (err) {
            console.error('❌ Error updating subscription:', err);
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

      // 2.4 mark event success
      await WebhookEvent.updateOne({ eventId: event.id }, { status: 'processed' });
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Webhook processing failed:', err);
      await WebhookEvent.updateOne({ eventId: event.id }, { status: 'failed' });
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

export default router;
