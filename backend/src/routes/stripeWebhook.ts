import express from 'express';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { connectToDatabase } from '../utils/db';
import PendingUser from '../models/pendingUser.model';
import User from '../models/user.model';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';
import MembershipLevel from '../models/membershipLevel.model';
import { syncSingleMembershipLevel } from '../utils/accounts/syncStripeMemberships';
import Order from '../models/order.model';
import Subscription from '../models/subscription.model';

const router = express.Router();

// Test endpoint to verify webhook route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Webhook route is working' });
});

// Debug endpoint to check webhook configuration
router.get('/debug', (req, res) => {
  res.json({
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 7) + '...',
    timestamp: new Date().toISOString()
  });
});

// Webhook handler - raw body is already parsed at app level
router.post('/', async (req, res) => {
    await connectToDatabase();
    
    console.log('🔔 Webhook received');
    console.log('🔔 Webhook body length:', req.body?.length || 'no body');
    console.log('🔔 Webhook headers:', Object.keys(req.headers));
    console.log('🔔 Body type:', typeof req.body);
    console.log('🔔 Body is Buffer:', Buffer.isBuffer(req.body));
    console.log('📋 Headers:', { 
      'stripe-signature': req.headers['stripe-signature'] ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    });
    
    let event: Stripe.Event;

    // 2.1 verify signature
    try {
      console.log('🔐 Verifying webhook signature...');
      
      // Ensure we have the required environment variable
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('❌ STRIPE_WEBHOOK_SECRET environment variable is missing');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }
      
      // Ensure we have the raw body and signature
      if (!req.body || !req.headers['stripe-signature']) {
        console.error('❌ Missing request body or stripe-signature header');
        return res.status(400).json({ error: 'Missing request body or signature' });
      }
      
      // req.body is a Buffer containing the *exact* bytes Stripe signed
      const signature = req.headers['stripe-signature'] as string;
      
      console.log('🔔 Raw body length:', req.body?.length || 'no body');
      console.log('🔔 Body is Buffer:', Buffer.isBuffer(req.body));
      console.log('🔔 Stripe signature present:', !!signature);

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      console.log('✅ Webhook signature verified');
      console.log('📦 Event details:', { id: event.id, type: event.type, created: new Date(event.created * 1000) });
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err);
      
      // Log more details for debugging
      console.error('❌ Error details:', {
        type: err.type,
        message: err.message,
        hasBody: !!req.body,
        bodyLength: req.body?.length,
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body),
        hasSignature: !!req.headers['stripe-signature'],
        signatureLength: (req.headers['stripe-signature'] as string)?.length,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length
      });
      
      return res.status(400).send('Invalid signature');
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
    try {
      await WebhookEvent.create({ eventId: event.id, eventType: event.type, status: 'failed' });
      console.log('✅ Event recorded in database');
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate event - check if it was already processed
        const existingEvent = await WebhookEvent.findOne({ eventId: event.id });
        if (existingEvent?.status === 'processed') {
          console.log('🔄 Event already processed, skipping:', { eventId: event.id });
          return res.status(200).json({ message: 'already processed' });
        }
        // Event exists but failed - update status and continue
        await WebhookEvent.updateOne({ eventId: event.id }, { status: 'failed' });
        console.log('✅ Updated existing failed event');
      } else {
        throw error;
      }
    }

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
          
          const { pendingUserId, userId, levelKey } = session.metadata ?? {};
          console.log('🔍 Extracted metadata:', { pendingUserId, userId, levelKey });

          // a) malformed → 400
          if ((!pendingUserId && !userId) || !levelKey) {
            console.log('❌ Missing required metadata:', { pendingUserId, userId, levelKey });
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

          // b) user lookup → 500
          let user;
          let pendingUser;
          if (userId) {
            // Existing user changing plans
            console.log('👤 Looking up existing user:', userId);
            user = await User.findById(userId);
            if (!user) {
              console.log('❌ User not found:', userId);
              throw new Error(`User not found: ${userId}`);
            }
            console.log('✅ Found existing user:', { id: user._id, email: user.email, username: user.username });
          } else {
            // New user registration
            console.log('👤 Looking up pending user:', pendingUserId);
            pendingUser = await PendingUser.findById(pendingUserId);
            if (!pendingUser) {
              console.log('❌ Pending user not found:', pendingUserId);
              throw new Error(`Pending user not found: ${pendingUserId}`);
            }
            console.log('✅ Found pending user:', { email: pendingUser.email, username: pendingUser.username });

            // Check if user already exists (in case of duplicate registrations)
            console.log('🔍 Checking if user already exists...');
            user = await User.findOne({ 
              $or: [{ email: pendingUser.email }, { username: pendingUser.username }] 
            });
            
            if (user) {
              console.log('✅ User already exists, using existing user:', { id: user._id, email: user.email });
            } else {
              console.log('👤 Creating new user from pending user...');
              user = await User.create({
                email:    pendingUser.email,
                username: pendingUser.username,
                passwordHash: pendingUser.passwordHash,
                name: pendingUser.name,
                avatarUrl: pendingUser.avatarUrl,
                role: 'subscriber',
                membershipLevel: pendingUser.levelKey
              });
              console.log('✅ Created new user:', { id: user._id, email: user.email, role: user.role });
            }
          }

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
          const order = await Order.create({
            userId: user._id,
            subscriptionId: subscription._id,
            membershipLevelId: level._id,
            gatewayPaymentId,        // pi_, sub_, or cs_
            totalCents: session.amount_total || 0,
            currency: session.currency || 'usd',
            billing: {
              name: (pendingUser || user).name?.first
                ? `${(pendingUser || user).name.first} ${(pendingUser || user).name.last ?? ''}`.trim()
                : (pendingUser || user).username || (pendingUser || user).email,
              email: (pendingUser || user).email,
            },
            status: 'COMPLETED',
            paidAt: new Date(),
          });
          console.log('✅ Created order');

          // Update user's membership level
          await User.findByIdAndUpdate(user._id, { membershipLevel: level.key });
          console.log('✅ Updated user membership level:', { userId: user._id, newLevel: level.key });

          // Update checkout session and clean up pending user (only for new registrations)
          if (pendingUser) {
            await CheckoutSession.findOneAndUpdate(
              { pendingUserId: pendingUser._id },
              { status: 'COMPLETED' }
            );
            await PendingUser.findByIdAndDelete(pendingUser._id);
            console.log('✅ Cleaned up pending user and checkout session');
          }

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

            // Find the existing subscription to check if this is a plan change
            const existingSubscription = await Subscription.findOne({ gatewaySubId: subscription.id });
            const isPlanChange = existingSubscription && 
                               existingSubscription.levelId.toString() !== membershipLevel._id.toString() &&
                               subscription.status === 'active';

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

            // Update the user's membership level if this is an active subscription
            if (subscription.status === 'active' && result) {
              const userUpdateResult = await User.findByIdAndUpdate(
                result.userId,
                { membershipLevel: membershipLevel.key },
                { new: true }
              );
              console.log('✅ User membership level updated:', { 
                userId: result.userId, 
                newLevel: membershipLevel.key,
                username: userUpdateResult?.username 
              });

              // Check if this is a plan change and create order if needed
              if (isPlanChange) {
                // Check if an order already exists for this plan change (to avoid duplicates)
                const existingOrder = await Order.findOne({
                  subscriptionId: result._id,
                  membershipLevelId: membershipLevel._id,
                  createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Within last 10 minutes
                });

                if (!existingOrder) {
                  // Get the latest invoice for this subscription
                  const latestInvoice = subscription.latest_invoice;
                  let orderAmount = 0;
                  let gatewayPaymentId = subscription.id;
                  
                  if (latestInvoice && typeof latestInvoice === 'string') {
                    try {
                      const invoice = await stripe.invoices.retrieve(latestInvoice);
                      orderAmount = Math.abs(invoice.amount_paid || invoice.amount_due);
                      gatewayPaymentId = invoice.id;
                      console.log('💰 Plan change webhook includes payment:', { 
                        invoiceId: invoice.id, 
                        amount: orderAmount 
                      });
                    } catch (invoiceError) {
                      console.warn('⚠️ Could not retrieve invoice in webhook:', invoiceError);
                    }
                  }

                  // Create order for audit trail
                  await Order.create({
                    userId: result.userId,
                    subscriptionId: result._id,
                    membershipLevelId: membershipLevel._id,
                    gatewayPaymentId: gatewayPaymentId,
                    totalCents: orderAmount,
                    currency: membershipLevel.currency,
                    billing: {
                      name: userUpdateResult?.name?.first
                        ? `${userUpdateResult.name.first} ${userUpdateResult.name.last ?? ''}`.trim()
                        : userUpdateResult?.username || userUpdateResult?.email,
                      email: userUpdateResult?.email,
                    },
                    status: 'COMPLETED',
                    paidAt: new Date(),
                  });
                  console.log('✅ Created order for plan change via webhook:', { 
                    amount: orderAmount, 
                    plan: membershipLevel.key 
                  });
                } else {
                  console.log('ℹ️ Order already exists for this plan change, skipping duplicate');
                }
              }
            }

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
          
        case 'payment_intent.succeeded':
          console.log('💳 Processing payment_intent.succeeded event');
          // This event is handled by checkout.session.completed, so we can skip it
          console.log('ℹ️ Payment intent succeeded - handled by checkout.session.completed');
          break;

        case 'charge.succeeded':
          console.log('💳 Processing charge.succeeded event');
          // This event is handled by checkout.session.completed, so we can skip it
          console.log('ℹ️ Charge succeeded - handled by checkout.session.completed');
          break;

        case 'payment_intent.created':
          console.log('💳 Processing payment_intent.created event');
          // This is just a creation event, no action needed
          console.log('ℹ️ Payment intent created - no action needed');
          break;

        case 'charge.updated':
          console.log('💳 Processing charge.updated event');
          // This is just an update event, no action needed
          console.log('ℹ️ Charge updated - no action needed');
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
