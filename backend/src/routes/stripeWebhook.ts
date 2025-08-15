import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { connectToDatabase } from '../utils/db';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';
import Subscription from '../models/subscription.model';
import MembershipLevel from '../models/membershipLevel.model';
import User from '../models/user.model';
import BillingProfile from '../models/billingProfile.model';
import Order from '../models/order.model';
import PendingUser from '../models/pendingUser.model';

const router = express.Router();

/**
 * Helper function to infer email from user by userId
 * Ensures non-empty email values for Order creation
 */
async function inferEmailFromUser(subscription: any): Promise<string> {
  try {
    const userId = subscription.beneficiaryUserId || subscription.userId;
    if (!userId) return 'unknown@example.com';
    
    const user = await User.findById(userId).select('email');
    return user?.email || 'unknown@example.com';
  } catch (error) {
    console.warn('Failed to infer email from user:', error);
    return 'unknown@example.com';
  }
}

async function ensureBeneficiaryFromSession(session: Stripe.Checkout.Session) {
  // Prefer explicit beneficiaryUserId (v2)
  const beneficiaryUserId = session.metadata?.beneficiaryUserId;
  if (beneficiaryUserId) {
    const u = await User.findById(beneficiaryUserId);
    if (!u) throw new Error(`beneficiaryUserId not found: ${beneficiaryUserId}`);
    return u;
  }

  // Legacy/new-user: create user from PendingUser if present and verified
  const pendingUserId = session.metadata?.pendingUserId;
  if (pendingUserId) {
    const p = await PendingUser.findById(pendingUserId);
    if (!p) throw new Error(`PendingUser ${pendingUserId} not found`);
    if (p.expiresAt && p.expiresAt < new Date()) throw new Error('PendingUser expired');
    if (!p.emailVerified) throw new Error('Pending user e-mail not verified');

    let u = await User.findOne({ email: p.email });
    if (!u) {
      try {
        u = await User.create({
          email: p.email,
          username: p.username,
          passwordHash: p.passwordHash,
          name: p.name,
          emailVerified: true,
          verifiedAt: new Date(),
        });
      } catch (e: any) {
        if (e?.code === 11000 && /username/i.test(e?.message)) {
          // Username collision - synthesize a unique username
          console.warn(`⚠️ Username collision for ${p.username}, synthesizing unique username`);
          const base = p.username?.slice(0, 20) || 'user';
          const unique = `${base}-${Math.random().toString(36).slice(2, 7)}`;
          u = await User.create({
            email: p.email,
            username: unique,
            passwordHash: p.passwordHash,
            name: p.name,
            emailVerified: true,
            verifiedAt: new Date(),
          });
          console.log(`✅ Created user with synthesized username: ${unique}`);
        } else {
          throw e;
        }
      }
    }
    // Clean up pending user (idempotent)
    await PendingUser.deleteOne({ _id: p._id });
    return u;
  }

  // Very old sessions: last resort try Stripe email
  const email = session.customer_details?.email || session.metadata?.email;
  if (email) {
    const u = await User.findOne({ email });
    if (u) return u;
  }

  throw new Error('No beneficiary resolvable from session metadata');
}

/**
 * Find the app Subscription impacted by a given PaymentIntent.
 * 1) Try your Order (gatewayPaymentId == PI id) → subscriptionId (ONE_TIME flow).
 * 2) Fallback: retrieve PI → invoice → subscription id → find by gatewaySubId (RECURRING flow).
 */
async function findSubscriptionByPaymentIntentId(piId: string) {
  // Try your Order mapping first (lifetime ONE_TIME path)
  try {
    const order = await Order.findOne({ gatewayPaymentId: piId }).select('subscriptionId');
    if (order?.subscriptionId) {
      const sub = await Subscription.findById(order.subscriptionId);
      if (sub) return sub;
    }
  } catch (e) {
    console.warn('⚠️ findSubscriptionByPaymentIntentId(Order) failed:', e);
  }

  // Fallback via Stripe invoice → subscription (recurring invoices/disputes/refunds)
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    const invId = typeof pi.invoice === 'string' ? pi.invoice : pi.invoice?.id;
    if (invId) {
      const inv = await stripe.invoices.retrieve(invId);
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      if (subId) {
        const sub = await Subscription.findOne({ gatewaySubId: subId });
        if (sub) return sub;
      }
    }
  } catch (e) {
    console.warn('⚠️ findSubscriptionByPaymentIntentId(Invoice) failed:', e);
  }

  return null;
}

/** Cancel a ONE_TIME entitlement in your DB (idempotent). */
async function cancelOneTimeEntitlement(subId: any) {
  await Subscription.updateOne(
    { _id: subId, kind: 'ONE_TIME', status: { $ne: 'CANCELLED' } },
    { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
  );
}

/** Cancel a Stripe subscription immediately and mirror it in DB (idempotent). */
async function cancelRecurringSubscription(sub: any) {
  try {
    if (sub.gatewaySubId) {
      await stripe.subscriptions.cancel(sub.gatewaySubId);
    }
  } catch (e) {
    // If it's already canceled or not found, that's fine—just mirror locally.
    console.warn('⚠️ Stripe sub cancel failed (continuing):', e);
  }
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
  );
}

// Helper functions for subscription management
async function resolveLevelByPriceId(priceId?: string) {
  if (!priceId) return null;
  return await MembershipLevel.findOne({ stripePriceId: priceId }).select('_id key');
}

async function upsertDbSubscriptionFromStripeSub(s: Stripe.Subscription) {
  const priceId = s.items?.data?.[0]?.price?.id || null;
  const level = priceId ? await resolveLevelByPriceId(priceId) : null;

  const appStatus =
    ['active','trialing','past_due','unpaid'].includes(s.status) ? 'ACTIVE' :
    (s.status === 'canceled' || s.status === 'incomplete_expired') ? 'CANCELLED' : 'ACTIVE';

  const existing = await Subscription.findOne({ gatewaySubId: s.id });
  if (!existing) {
    return null;
  }

  const $set: any = {
    levelId: level?._id ?? existing.levelId,
    kind: 'RECURRING',
    gateway: 'stripe',
    status: appStatus,
    autoRenews: !s.cancel_at_period_end,
    startDate: s.current_period_start ? new Date(s.current_period_start * 1000) : existing.startDate,
    nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : existing.nextBillDate ?? null,
    endDate: s.cancel_at_period_end && s.current_period_end ? new Date(s.current_period_end * 1000) : existing.endDate ?? null,
  };

  return Subscription.findOneAndUpdate(
    { gatewaySubId: s.id },
    { $set },
    { new: true, runValidators: true }
  );
}

function toAppStatus(s: Stripe.Subscription.Status): 'ACTIVE'|'CANCELLED' {
  return ['active','trialing','past_due','unpaid'].includes(s) ? 'ACTIVE' : 'CANCELLED';
}

// Health check endpoint for webhook monitoring
router.get('/health', async (req, res) => {
  try {
    // Quick database connectivity check
    await connectToDatabase();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('❌ Webhook health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint to verify webhook route is accessible
router.get('/test', (req, res) => {
  res.json({
    message: 'Webhook route is accessible',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl
  });
});

// Webhook status endpoint for monitoring
router.get('/status', async (req, res) => {
  try {
    await connectToDatabase();
    
    // Get recent webhook events
    const recentEvents = await WebhookEvent.find()
      .sort({ processedAt: -1 })
      .limit(10)
      .select('eventId eventType status processedAt');
    
    res.json({
      timestamp: new Date().toISOString(),
      status: 'operational',
      database: 'connected',
      webhook: {
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        recentEvents: recentEvents.map(event => ({
          id: event.eventId,
          type: event.eventType,
          status: event.status,
          processedAt: event.processedAt
        }))
      },
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('❌ Webhook status check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Webhook status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Webhook handler - processes Stripe webhook events
 *
 * Claim policy:
 * - Exactly-once handling via a claim record
 * - Reclaim ONLY after an explicit 'failed' status
 */
router.post(
  '/',
  // Only this POST uses raw body; GETs use normal parsers
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
  console.log('🔔 Webhook received at:', new Date().toISOString());
  console.log('🔎 Buffer?', Buffer.isBuffer(req.body), 'len:', Buffer.isBuffer(req.body) ? req.body.length : 'n/a');
  
  // DO NOT read or mutate req.body here. Express.raw at app level must put a Buffer on req.body.
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) {
    console.error('❌ Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,                  // must be Buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!   // use your Dashboard secret in prod
    );
    console.log('✅ Webhook signature verified');
    console.log('📦 Event details:', { id: event.id, type: event.type, created: new Date(event.created * 1000) });
  } catch (err: any) {
    console.error('❌ Signature verify failed:', err?.message);
    return res.status(400).send('Bad signature');
  }

  // ⛔️ If Atlas egress is blocked, this connect will hang. Fix allowlist (see section C).
  try {
    await connectToDatabase();
    console.log('✅ Database connected successfully');
  } catch (e) {
    console.error('❌ DB connect failed:', e);
    // Let Stripe retry
    return res.status(500).send('DB connect failed');
  }

  // CLAIM MECHANISM: Only one process handles each event.
  // Reclaim is allowed ONLY if the last attempt explicitly failed.
  console.log('🔒 Attempting to claim webhook event...');
  let claim;
  try {
    claim = await WebhookEvent.findOneAndUpdate(
      {
        eventId: event.id,
        $or: [
          { claimed: { $ne: true } }, // never claimed
          { status: 'failed' }        // explicit reclaim after a failure
        ],
      },
      {
        $setOnInsert: { eventId: event.id, eventType: event.type, processedAt: new Date() },
        $set: { claimed: true, claimedAt: new Date(), status: 'processing', errorMessage: undefined }
      },
      { upsert: true, new: true }
    );
  } catch (e: any) {
    if (e?.code === 11000) {
      console.log('⚠️ Event already claimed (duplicate key), exiting');
      return res.status(200).send('ok');
    }
    throw e;
  }

  if (!claim || claim.status === 'processed') {
    console.log('⚠️ Event already claimed or processed, exiting');
    return res.status(200).send('ok');
  }

  console.log('✅ Event claimed successfully, processing...');

  try {
    console.log('🔄 Processing event type:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('💳 checkout.session.completed', { id: session.id, mode: session.mode, metadata: session.metadata });

        // Retrieve session with expanded line_items to get priceId reliably
        const expandedSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] });
        const priceId = (expandedSession as any)?.line_items?.data?.[0]?.price?.id;

        // Always mark local CheckoutSession for observability
        await CheckoutSession.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            $set: {
              stripeSessionId: session.id,
              status: 'COMPLETED',
              stripeSessionStatus: session.status,
              stripePaymentStatus: session.payment_status,
              completedAt: new Date(),
              priceId: priceId ?? undefined,
              beneficiaryUserId: session.metadata?.beneficiaryUserId ?? undefined,
              billingProfileId: session.metadata?.billingProfileId ?? undefined,
            }
          },
          { upsert: true }
        );

        // Resolve beneficiary (existing or from PendingUser) — single source of truth
        const beneficiary = await ensureBeneficiaryFromSession(session);
        const billingProfileId = session.metadata?.billingProfileId || null;

        // Link Stripe customer to User for convenience
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (customerId) await User.updateOne({ _id: beneficiary._id }, { $set: { stripeCustomerId: customerId } });

        if (session.mode === 'subscription') {
          // Create/Upsert RECURRING subscription now
          const stripeSubId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
          if (!stripeSubId) throw new Error('No subscription id on session');

          const s = await stripe.subscriptions.retrieve(stripeSubId);
          const subscriptionPriceId = s.items?.data?.[0]?.price?.id || null;
          const level = subscriptionPriceId ? await MembershipLevel.findOne({ stripePriceId: subscriptionPriceId }) : null;

          const doc = await Subscription.findOneAndUpdate(
            { gatewaySubId: s.id },
            {
              $set: {
                userId: beneficiary._id,                 // back-compat
                beneficiaryUserId: beneficiary._id,      // canonical
                billingProfileId,
                levelId: level?._id ?? undefined,
                kind: 'RECURRING',
                autoRenews: !s.cancel_at_period_end,
                gateway: 'stripe',
                status: toAppStatus(s.status),
                startDate: new Date(s.start_date * 1000),
                nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
                endDate: s.cancel_at_period_end && s.current_period_end ? new Date(s.current_period_end * 1000) : null
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Optional: fast cache on user (webhook is the only writer)
          if (beneficiary._id && level?.key) {
            await User.updateOne({ _id: beneficiary._id }, { $set: { membershipLevel: level.key } });
          }
        } else if (session.mode === 'payment') {
          // ONE_TIME entitlement + Order by PaymentIntent
          const level = priceId ? await MembershipLevel.findOne({ stripePriceId: priceId }) : null;

          const sub = await Subscription.create({
            userId: beneficiary._id,                 // back-compat
            beneficiaryUserId: beneficiary._id,      // canonical
            billingProfileId,
            levelId: level?._id,
            kind: 'ONE_TIME',
            autoRenews: false,
            gateway: 'stripe',
            status: 'ACTIVE',
            startDate: new Date(),
          });

          // Always store the PaymentIntent id. If it's missing on the event's session, 
          // retrieve the session (expand PI) before writing the Order.
          let piId: string | null = null;
          if (typeof session.payment_intent === 'string') {
            piId = session.payment_intent;
          } else if ((session as any).payment_intent?.id) {
            piId = (session as any).payment_intent.id;
          } else {
            const fresh = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent'] });
            piId = typeof fresh.payment_intent === 'string'
              ? fresh.payment_intent
              : fresh.payment_intent?.id || null;
          }

          const gatewayPaymentId = piId ?? session.id; // but with the retrieval, piId should be set

          await Order.updateOne(
            { gatewayPaymentId },
            {
              $setOnInsert: {
                userId: beneficiary._id,
                subscriptionId: sub._id,
                membershipLevelId: level?._id,
                totalCents: session.amount_total ?? 0,
                currency: session.currency ?? 'usd',
                billing: {
                  name: session.customer_details?.name || beneficiary.username || beneficiary.email,
                  email: session.customer_details?.email || beneficiary.email,
                },
                status: 'COMPLETED',
                paidAt: new Date(),
              },
            },
            { upsert: true, runValidators: true }
          );
        }

        // After creating Subscription/Order, mark the session ready
        await CheckoutSession.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            $set: {
              ready: true,
              readyAt: new Date(),
              userId: beneficiary._id,
            }
          }
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
        if (!subId) break;

        const s = await stripe.subscriptions.retrieve(subId);
        const appSub = await Subscription.findOne({ gatewaySubId: s.id });
        if (!appSub) { console.log('ℹ️ invoice: app subscription not found', { subId: s.id }); break; }

        // Don't proceed unless you have a usable appSub with userId/beneficiaryUserId
        if (!appSub?.beneficiaryUserId && !appSub?.userId) {
          console.warn('invoice: missing subscription ownership, skipping order create');
          break;
        }

        // Keep ACTIVE + refresh next bill date only if Stripe is active/trialing
        if (['active','trialing'].includes(s.status)) {
          await Subscription.updateOne(
            { _id: appSub._id },
            { $set: { status: 'ACTIVE', nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null } }
          );
        }

        // Create an order tied to the Invoice (NOT gatewayPaymentId)
        const gatewayInvoiceId = inv.id;
        await Order.updateOne(
          { gatewayInvoiceId },
          {
            $setOnInsert: {
              userId: appSub.beneficiaryUserId || appSub.userId,
              subscriptionId: appSub._id,
              membershipLevelId: appSub.levelId,
              totalCents: inv.amount_paid ?? 0,
              currency: inv.currency ?? 'usd',
              billing: {
                name: inv.customer_name || 'Customer',
                email: inv.customer_email || (await inferEmailFromUser(appSub)), // ensure non-empty
              },
              status: 'COMPLETED',
              paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date(),
            },
          },
          { upsert: true, runValidators: true }
        );
        break;
      }

      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('🆕 subscription.created', { id: sub.id, status: sub.status });
        
        // Check if subscription already exists (should be created by checkout.session.completed)
        const existing = await Subscription.findOne({ gatewaySubId: sub.id });
        if (existing) {
          console.log('✅ Subscription already exists, updating with Stripe data while preserving beneficiary relationships');
        } else {
          console.log('⚠️ Subscription not found - should have been created by checkout.session.completed');
        }
        
        const doc = await upsertDbSubscriptionFromStripeSub(sub);
        if (doc) {
          // Optional: if you still want to sync a "fast cache" on the User,
          // do it ONLY if doc.userId exists (don't derive from customer here).
          if (doc?.userId) {
            const priceId = sub.items?.data?.[0]?.price?.id || null;
            const level = priceId ? await resolveLevelByPriceId(priceId) : null;
            if (level?.key) {
              await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('🔄 subscription.updated', { id: sub.id, status: sub.status });
        
        // Check existing subscription to show what relationships we're preserving
        const existing = await Subscription.findOne({ gatewaySubId: sub.id });
        if (existing) {
          console.log('✅ Updating existing subscription while preserving:', {
            beneficiaryUserId: existing.beneficiaryUserId,
            billingProfileId: existing.billingProfileId,
            userId: existing.userId
          });
        }
        
        const doc = await upsertDbSubscriptionFromStripeSub(sub);
        if (doc) {
          // Optional: if you still want to sync a "fast cache" on the User,
          // do it ONLY if doc.userId exists (don't derive from customer here).
          if (doc?.userId) {
            const priceId = sub.items?.data?.[0]?.price?.id || null;
            const level = priceId ? await resolveLevelByPriceId(priceId) : null;
            if (level?.key) {
              await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        console.log('❌ subscription.deleted', { id: deletedSub.id });
        await Subscription.updateMany(
          { gatewaySubId: deletedSub.id },
          { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
        );
        break;
      }

      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        console.log('🆕 customer.created', { 
          id: customer.id, 
          email: customer.email,
          name: customer.name 
        });
        
        // Try to find and update billing profile by email
        if (customer.email) {
          try {
            const normalizedEmail = customer.email.trim().toLowerCase();
            const billingProfile = await BillingProfile.findOne({ normalizedEmail });
            
            if (billingProfile && !billingProfile.stripeCustomerId) {
              console.log('🔄 Updating billing profile with new Stripe customer ID:', {
                billingProfileId: billingProfile._id,
                customerId: customer.id
              });
              
              await BillingProfile.findByIdAndUpdate(
                billingProfile._id,
                { 
                  $set: { 
                    stripeCustomerId: customer.id,
                    email: customer.email,
                    name: customer.name || null
                  }
                }
              );
              
              console.log('✅ Updated billing profile with Stripe customer ID');
            } else if (billingProfile) {
              console.log('ℹ️ Billing profile already has Stripe customer ID:', billingProfile.stripeCustomerId);
            } else {
              console.log('ℹ️ No billing profile found for customer email:', customer.email);
            }
          } catch (bpError) {
            console.error('❌ Failed to update billing profile for new customer:', bpError);
          }
        }
        break;
      }

      case 'subscription_schedule.created':
        console.log('📅 Processing subscription schedule creation');
        const createdSchedule = event.data.object as Stripe.SubscriptionSchedule;
        try {
          // Log the schedule details for debugging
          console.log('📅 New subscription schedule created:', {
            id: createdSchedule.id,
            customer: createdSchedule.customer,
            status: createdSchedule.status,
            phases: createdSchedule.phases?.map(phase => ({
              start_date: phase.start_date,
              end_date: phase.end_date,
              items: phase.items
            }))
          });
          
          // You can add logic here to track scheduled changes
          // For now, just log the event
          console.log('✅ Subscription schedule creation logged');
        } catch (e) {
          console.warn('⚠️ Could not process subscription schedule creation:', e);
        }
        break;

      case 'subscription_schedule.updated':
        console.log('📅 Processing subscription schedule update');
        const updatedSchedule = event.data.object as Stripe.SubscriptionSchedule;
        try {
          console.log('📅 Subscription schedule updated:', {
            id: updatedSchedule.id,
            customer: updatedSchedule.customer,
            status: updatedSchedule.status,
            phases: updatedSchedule.phases?.map(phase => ({
              start_date: phase.start_date,
              end_date: phase.end_date,
              items: phase.items
            }))
          });
          
          // Track schedule modifications
          console.log('✅ Subscription schedule update logged');
        } catch (e) {
          console.warn('⚠️ Could not process subscription schedule update:', e);
        }
        break;

      case 'subscription_schedule.completed':
        console.log('📅 Processing subscription schedule completion');
        const completedSchedule = event.data.object as Stripe.SubscriptionSchedule;
        try {
          console.log('📅 Subscription schedule completed:', {
            id: completedSchedule.id,
            customer: completedSchedule.customer,
            subscription: completedSchedule.subscription
          });
          
          // When a schedule completes, the new subscription is active
          // Update your database to reflect the new plan
          if (completedSchedule.subscription && typeof completedSchedule.subscription === 'string') {
            const newSubscription = await stripe.subscriptions.retrieve(completedSchedule.subscription);
            
            // Find the membership level based on the new price
            const newPriceId = newSubscription.items.data[0]?.price.id;
            const level = newPriceId ? await resolveLevelByPriceId(newPriceId) : null;
            if (level?._id) {
              // Update the subscription with new details including levelId
              await Subscription.updateMany(
                { gatewaySubId: newSubscription.id },
                {
                  $set: {
                    levelId: level._id,
                    status: toAppStatus(newSubscription.status),
                    nextBillDate: newSubscription.current_period_end ? new Date(newSubscription.current_period_end * 1000) : null
                  }
                }
              );
              console.log('✅ Updated subscription after schedule completion:', newSubscription.id);
            }
          }
          
          console.log('✅ Subscription schedule completion processed');
        } catch (e) {
          console.warn('⚠️ Could not process subscription schedule completion:', e);
        }
        break;

      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge;
        const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
        if (!piId) { console.log('↩️ charge.refunded without payment_intent – skipping'); break; }

        // Full vs partial
        const amount = ch.amount ?? ch.amount_captured ?? 0;
        const fullRefund = (ch.amount_refunded ?? 0) >= amount;

        // Only enforce auto-revoke for ONE_TIME on full refunds
        if (!fullRefund) {
          console.log('↩️ Partial refund detected, leaving access as-is (policy).', {
            amount, refunded: ch.amount_refunded
          });
          break;
        }

        const sub = await findSubscriptionByPaymentIntentId(piId);
        if (!sub) {
          console.log('↩️ No linked subscription found for refunded PI', piId);
          break;
        }

        if (sub.kind === 'ONE_TIME') {
          await cancelOneTimeEntitlement(sub._id);
          console.log('✅ ONE_TIME entitlement cancelled due to full refund', { subId: String(sub._id) });
        } else {
          // For recurring invoice refunds: no automatic cancel (policy); just log.
          console.log('ℹ️ Refunded charge is tied to a recurring subscription; not cancelling automatically.', {
            appSubId: String(sub._id), gatewaySubId: sub.gatewaySubId
          });
        }
        break;
      }

      case 'charge.dispute.closed': {
        const d = event.data.object as Stripe.Dispute;
        const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
        if (!piId) { console.log('⚖️ dispute.closed without payment_intent – skipping'); break; }

        const sub = await findSubscriptionByPaymentIntentId(piId);
        if (!sub) {
          console.log('⚖️ dispute.closed: no linked subscription found for PI', piId);
          break;
        }

        // Outcome: 'won' or 'lost' (sometimes 'warning_closed')
        const outcome = d.status; // 'won' | 'lost' | 'warning_closed'
        console.log('⚖️ Dispute closed:', { outcome, subId: String(sub._id), kind: sub.kind });

        if (outcome === 'lost') {
          if (sub.kind === 'ONE_TIME') {
            await cancelOneTimeEntitlement(sub._id);
            console.log('⛔ ONE_TIME revoked due to lost dispute', { subId: String(sub._id) });
          } else if (sub.kind === 'RECURRING') {
            await cancelRecurringSubscription(sub);
            console.log('⛔ RECURRING cancelled due to lost dispute', {
              appSubId: String(sub._id), gatewaySubId: sub.gatewaySubId
            });
          }
        } else {
          // won or warning_closed → keep/restore access (nothing to change)
          console.log('✅ Dispute not lost; leaving entitlements as-is.');
          // If you later add an "onHold" flag, you could clear it here.
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    // Update status and set accurate completion time
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { $set: { status: 'processed', processedAt: new Date() } }
    );
    console.log('✅ Webhook event processed successfully:', event.id);

    // Acknowledge to Stripe
    return res.status(200).send('ok');
  } catch (e) {
    console.error('❌ Processing failed:', e);
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { 
        $set: { status: 'failed', processedAt: new Date(), errorMessage: String(e?.message || e) },
        $unset: { claimed: "", claimedAt: "" } // Let a retry claim it
      }
    );
    // Non-2xx makes Stripe retry
    return res.status(500).send('error');
  }
});

export default router;
