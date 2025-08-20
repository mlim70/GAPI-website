import express, { Request, Response, Router } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { connectToDatabase } from '../utils/db';
import { STRIPE_WEBHOOK_SECRET } from '../config/env';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';
import Subscription from '../models/subscription.model';
import MembershipLevel from '../models/membershipLevel.model';
import User from '../models/user.model';
import Order from '../models/order.model';

const router = Router();

/**
 * Helper function to infer email from user by userId
 * Ensures non-empty email values for Order creation
 */
async function inferEmailFromUser(subscription: any): Promise<string> {
  try {
    const user = await User.findById(subscription.userId).select('email');
    return user?.email || 'unknown@example.com';
  } catch {
    return 'unknown@example.com';
  }
}

/**
 * Resolve the purchasing User from a Checkout Session.
 * All sessions must now have metadata.userId set.
 */
async function resolveUserFromSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) throw new Error('Missing metadata.userId on session'); // hard requirement now
  const user = await User.findById(userId);
  if (!user) throw new Error(`userId not found: ${userId}`);
  return user;
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
  const sub = await Subscription.findById(subId);
  if (sub?.userId) {
    // Clear fast cache on user
    await User.updateOne({ _id: sub.userId }, { $unset: { membershipLevel: '' } });
  }

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

  // Clear fast cache on user
  if (sub.userId) {
    await User.updateOne({ _id: sub.userId }, { $unset: { membershipLevel: '' } });
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
  const priceId = s.items?.data?.[0]?.price?.id ?? null;
  const level = priceId ? await resolveLevelByPriceId(priceId) : null;

  // Map Stripe status → app status
  const appStatus: 'ACTIVE' | 'CANCELLED' =
    ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status) ? 'ACTIVE' : 'CANCELLED';

  // Map Stripe customer -> User (may still be null early)
  const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
  const resolvedUser = custId ? await User.findOne({ stripeCustomerId: custId }).select('_id') : null;

  // Upsert by Stripe sub id
  const doc = await Subscription.findOneAndUpdate(
    { gatewaySubId: s.id },
    {
      $set: {
        levelId: level?._id ?? undefined,
        kind: 'RECURRING',
        gateway: 'stripe',
        status: appStatus,
        autoRenews: !s.cancel_at_period_end,
        startDate: new Date(((s.start_date ?? s.current_period_start) * 1000)),
        nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
        endDate: s.cancel_at_period_end && s.current_period_end ? new Date(s.current_period_end * 1000) : null,
        // 👇 NEW: if we can resolve a user, write it even on updates
        ...(resolvedUser?._id ? { userId: resolvedUser._id } : {}),
      },
      $setOnInsert: {
        // userId is handled in $set above to allow updates to attach users later
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Extra safety: if still missing userId but we can infer it a different way later, hook here
  return doc;
}

function toAppStatus(s: Stripe.Subscription.Status): 'ACTIVE' | 'CANCELLED' {
  return ['active', 'trialing', 'past_due', 'unpaid'].includes(s) ? 'ACTIVE' : 'CANCELLED';
}



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

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      console.error('❌ Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
      console.log('✅ Webhook signature verified');
      console.log('📦 Event details:', { id: event.id, type: event.type, created: new Date(event.created * 1000) });
    } catch (err: any) {
      console.error('❌ Signature verify failed:', err?.message);
      return res.status(400).send('Bad signature');
    }

    try {
      await connectToDatabase();
      console.log('✅ Database connected successfully');
    } catch (e) {
      console.error('❌ DB connect failed:', e);
      return res.status(500).send('DB connect failed');
    }

    // Exactly-once claim
    console.log('🔒 Attempting to claim webhook event...');
    let claim;
    try {
      claim = await WebhookEvent.findOneAndUpdate(
        {
          eventId: event.id,
          $or: [{ claimed: { $ne: true } }, { status: 'failed' }],
        },
        {
          $setOnInsert: { eventId: event.id, eventType: event.type, processedAt: new Date() },
          $set: { claimed: true, claimedAt: new Date(), status: 'processing', errorMessage: undefined },
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

          // Retrieve session with expanded line_items for subscription processing
          const expandedSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] });
          const priceId = (expandedSession as any)?.line_items?.data?.[0]?.price?.id;

          // Mark local CheckoutSession as completed
          await CheckoutSession.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              $set: {
                status: 'COMPLETED',
              },
            },
            { upsert: false } // Don't create if doesn't exist
          );

          // Resolve the purchasing user from session metadata
          const purchasingUser = await resolveUserFromSession(session);

          // Link Stripe customer to User for convenience (set once, never flip)
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
          if (customerId && !purchasingUser.stripeCustomerId) {
            await User.updateOne({ _id: purchasingUser._id }, { $set: { stripeCustomerId: customerId } });
          }

          if (session.mode === 'subscription') {
            // Create/Upsert RECURRING subscription now
            const stripeSubId = typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id;
            if (!stripeSubId) throw new Error('No subscription id on session');

            const s = await stripe.subscriptions.retrieve(stripeSubId);

            // Ensure subscription exists and is up-to-date
            const doc = await upsertDbSubscriptionFromStripeSub(s);

            // Update userId if not already set
            if (doc && !doc.userId) {
              await Subscription.updateOne(
                { _id: doc._id },
                { $set: { userId: purchasingUser._id } }
              );
            }

            // 👇 NEW: if Checkout says payment was successful, force ACTIVE
            if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
              await Subscription.updateOne({ _id: doc._id }, { $set: { status: 'ACTIVE' } });
            }

            // Optional: fast cache on user (webhook is the only writer)
            if (purchasingUser._id && doc?.levelId) {
              const level = await MembershipLevel.findById(doc.levelId);
              if (level?.key) {
                await User.updateOne({ _id: purchasingUser._id }, { $set: { membershipLevel: level.key } });
              }
            }
            
            // Clear signupIntent once checkout completes and subscription is ACTIVE
            await User.updateOne(
              { _id: purchasingUser._id },
              { $unset: { signupIntent: 1 } }
            );
          } else if (session.mode === 'payment') {
            // ONE_TIME entitlement + Order by PaymentIntent
            const level = priceId ? await MembershipLevel.findOne({ stripePriceId: priceId }) : null;

            // Create subscription
            const sub = await Subscription.create({
              userId: purchasingUser._id,
              levelId: level?._id,
              kind: 'ONE_TIME',
              autoRenews: false,
              gateway: 'stripe',
              status: 'ACTIVE',
              startDate: new Date(),
            });

            // Always store the PaymentIntent id
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

            const gatewayPaymentId = piId ?? session.id;

            await Order.updateOne(
              { gatewayPaymentId },
              {
                $setOnInsert: {
                  userId: purchasingUser._id,
                  subscriptionId: sub._id,
                  membershipLevelId: level?._id,
                  totalCents: session.amount_total ?? 0,
                  currency: session.currency ?? 'usd',
                  billing: {
                    name: session.customer_details?.name || purchasingUser.username || purchasingUser.email,
                    email: session.customer_details?.email || purchasingUser.email,
                  },
                  status: 'COMPLETED',
                  paidAt: new Date(),
                },
              },
              { upsert: true, runValidators: true }
            );
            
            // Clear signupIntent once ONE_TIME checkout completes
            await User.updateOne(
              { _id: purchasingUser._id },
              { $unset: { signupIntent: 1 } }
            );
          }

          // After creating Subscription/Order, mark the session completed
          await CheckoutSession.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              $set: {
                status: 'COMPLETED',
              },
            }
          );
          break;
        }

        case 'invoice.payment_succeeded': {
          const inv = event.data.object as Stripe.Invoice;

          // 1) Identify the subscription (most invoices in your flow have one)
          const sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
          if (!sid) {
            console.log('🧾 invoice.payment_succeeded without subscription → skipping order creation');
            break;
          }

          // 2) Load Stripe sub + upsert local snapshot (may lack userId at this moment)
          const s = await stripe.subscriptions.retrieve(sid);
          let appSub = await Subscription.findOne({ gatewaySubId: s.id });
          if (!appSub) appSub = await upsertDbSubscriptionFromStripeSub(s); // recover/mirror

          // 3) Ensure we know the user who paid (race-safe)
          if (!appSub?.userId) {
            // Try by Stripe customer id
            const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
            let user = custId ? await User.findOne({ stripeCustomerId: custId }) : null;

            // Fallback: try by email on the invoice
            if (!user && inv.customer_email) {
              user = await User.findOne({ email: inv.customer_email });
            }

            if (user) {
              await Subscription.updateOne({ _id: appSub!._id }, { $set: { userId: user._id } });
              appSub = await Subscription.findById(appSub!._id); // refresh
            } else {
              // Still no user → log and retry next time (don't create order without userId)
              console.warn('⚠️ invoice.payment_succeeded: unable to resolve user; will not write Order yet', {
                invoiceId: inv.id,
                custId: custId || null,
                invoiceEmail: inv.customer_email || null,
                appSubId: appSub?._id ? String(appSub._id) : null,
              });
              break;
            }
          }

          // 4) Ensure we know the membership level (levelId) for required Order field
          if (!appSub!.levelId) {
            // Try to get the price from the invoice lines (expand if needed)
            let priceId: string | null = null;
            try {
              const fullInv = inv.lines?.data?.length
                ? inv
                : await stripe.invoices.retrieve(inv.id, { expand: ['lines.data.price'] });

              const firstLine = fullInv.lines?.data?.[0];
              priceId = (firstLine?.price?.id as string) || null;

              if (priceId) {
                const level = await MembershipLevel.findOne({ stripePriceId: priceId }).select('_id');
                if (level?._id) {
                  await Subscription.updateOne({ _id: appSub!._id }, { $set: { levelId: level._id } });
                  appSub = await Subscription.findById(appSub!._id).select('levelId userId');
                }
              }
            } catch (e) {
              console.warn('⚠️ Could not expand invoice lines to resolve price/level', e);
            }

            if (!appSub!.levelId) {
              console.warn('⚠️ invoice.payment_succeeded: missing levelId even after backfill; skipping Order write', {
                invoiceId: inv.id, priceId
              });
              break;
            }
          }

          // 5) Keep ACTIVE + refresh next bill date only if Stripe is active/trialing
          if (['active', 'trialing'].includes(s.status)) {
            await Subscription.updateOne(
              { _id: appSub!._id },
              { $set: { status: 'ACTIVE', nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null } }
            );
            
            // Clear signupIntent once subscription is confirmed ACTIVE
            await User.updateOne(
              { _id: appSub!.userId },
              { $unset: { signupIntent: 1 } }
            );
          }

          // 6) Create the Order (idempotent on gatewayInvoiceId)
          const gatewayInvoiceId = inv.id;
          try {
            await Order.updateOne(
              { gatewayInvoiceId },
              {
                $setOnInsert: {
                  userId: appSub!.userId,
                  subscriptionId: appSub!._id,
                  membershipLevelId: appSub!.levelId,
                  totalCents: inv.amount_paid ?? 0,
                  currency: inv.currency ?? 'usd',
                  billing: {
                    name: inv.customer_name || 'Customer',
                    email: inv.customer_email || (await inferEmailFromUser(appSub)),
                  },
                  status: 'COMPLETED',
                  paidAt: inv.status_transitions?.paid_at
                    ? new Date(inv.status_transitions.paid_at * 1000)
                    : new Date(),
                },
              },
              { upsert: true, runValidators: true }
            );
            console.log('🧾✅ Order upserted for invoice', gatewayInvoiceId);
          } catch (e: any) {
            console.error('❌ Failed to upsert Order for invoice', gatewayInvoiceId, e?.message || e);
            // Don't throw: webhook should still ack; the event remains claimed and won't retry.
            // If you want retries, store a PendingOrder doc here.
          }

          break;
        }

        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          const sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
          if (!sid) break;

          // Refresh our snapshot of the subscription; do not auto-cancel here
          try {
            const s = await stripe.subscriptions.retrieve(sid);
            await upsertDbSubscriptionFromStripeSub(s);
            console.log('⚠️ invoice.payment_failed: refreshed local subscription snapshot', { sid });
          } catch (e) {
            console.warn('⚠️ invoice.payment_failed: unable to refresh subscription', e);
          }
          break;
        }

        case 'customer.subscription.created': {
          const sub = event.data.object as Stripe.Subscription;
          console.log('🆕 subscription.created', { id: sub.id, status: sub.status });

          const doc = await upsertDbSubscriptionFromStripeSub(sub);
          if (doc?.userId) {
            const priceId = sub.items?.data?.[0]?.price?.id || null;
            const level = priceId ? await resolveLevelByPriceId(priceId) : null;
            if (level?.key) {
              await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
            }
            
            // Clear signupIntent once subscription is created
            await User.updateOne(
              { _id: doc.userId },
              { $unset: { signupIntent: 1 } }
            );
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          console.log('🔄 subscription.updated', { id: sub.id, status: sub.status });

          const doc = await upsertDbSubscriptionFromStripeSub(sub);
          if (doc?.userId) {
            if (['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) {
              // Keep membership during dunning (past_due/unpaid) to maintain access
              const priceId = sub.items?.data?.[0]?.price?.id || null;
              const level = priceId ? await resolveLevelByPriceId(priceId) : null;
              if (level?.key) {
                await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
              }
              
              // Clear signupIntent once subscription becomes ACTIVE
              if (['active', 'trialing'].includes(sub.status)) {
                await User.updateOne(
                  { _id: doc.userId },
                  { $unset: { signupIntent: 1 } }
                );
              }
            } else if (['canceled', 'paused', 'incomplete', 'incomplete_expired'].includes(sub.status)) {
              // Only clear membership for truly terminated/incomplete subscriptions
              await User.updateOne({ _id: doc.userId }, { $unset: { membershipLevel: '' } });
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

          // Clear fast cache on user
          const custId = typeof deletedSub.customer === 'string' ? deletedSub.customer : deletedSub.customer?.id;
          const user = custId ? await User.findOne({ stripeCustomerId: custId }).select('_id') : null;
          if (user) await User.updateOne({ _id: user._id }, { $unset: { membershipLevel: '' } });
          break;
        }

        case 'customer.created': {
          const customer = event.data.object as Stripe.Customer;
          console.log('🆕 customer.created', {
            id: customer.id,
            email: customer.email,
            name: customer.name,
          });
          console.log('ℹ️ Simple model: customer created, no BillingProfile handling needed');
          break;
        }

        case 'subscription_schedule.created': {
          console.log('📅 Processing subscription schedule creation');
          const createdSchedule = event.data.object as Stripe.SubscriptionSchedule;
          try {
            console.log('📅 New subscription schedule created:', {
              id: createdSchedule.id,
              customer: createdSchedule.customer,
              status: createdSchedule.status,
              phases: createdSchedule.phases?.map((phase) => ({
                start_date: phase.start_date,
                end_date: phase.end_date,
                items: phase.items,
              })),
            });
            console.log('✅ Subscription schedule creation logged');
          } catch (e) {
            console.warn('⚠️ Could not process subscription schedule creation:', e);
          }
          break;
        }

        case 'subscription_schedule.updated': {
          console.log('📅 Processing subscription schedule update');
          const updatedSchedule = event.data.object as Stripe.SubscriptionSchedule;
          try {
            console.log('📅 Subscription schedule updated:', {
              id: updatedSchedule.id,
              customer: updatedSchedule.customer,
              status: updatedSchedule.status,
              phases: updatedSchedule.phases?.map((phase) => ({
                start_date: phase.start_date,
                end_date: phase.end_date,
                items: phase.items,
              })),
            });
            console.log('✅ Subscription schedule update logged');
          } catch (e) {
            console.warn('⚠️ Could not process subscription schedule update:', e);
          }
          break;
        }

        case 'subscription_schedule.completed': {
          console.log('📅 Processing subscription schedule completion');
          const completedSchedule = event.data.object as Stripe.SubscriptionSchedule;
          try {
            console.log('📅 Subscription schedule completed:', {
              id: completedSchedule.id,
              customer: completedSchedule.customer,
              subscription: completedSchedule.subscription,
            });

            if (completedSchedule.subscription && typeof completedSchedule.subscription === 'string') {
              const newSubscription = await stripe.subscriptions.retrieve(completedSchedule.subscription);
              const updatedSub = await upsertDbSubscriptionFromStripeSub(newSubscription);
              if (updatedSub) {
                console.log('✅ Updated subscription after schedule completion:', newSubscription.id);
              }
            }
            console.log('✅ Subscription schedule completion processed');
          } catch (e) {
            console.warn('⚠️ Could not process subscription schedule completion:', e);
          }
          break;
        }

        case 'charge.refunded': {
          const ch = event.data.object as Stripe.Charge;
          const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
          if (!piId) {
            console.log('↩️ charge.refunded without payment_intent – skipping');
            break;
          }

          const amount = ch.amount ?? ch.amount_captured ?? 0;
          const fullRefund = (ch.amount_refunded ?? 0) >= amount;

          console.log('↩️ Processing refund:', { 
            chargeId: ch.id, 
            amount, 
            refunded: ch.amount_refunded, 
            fullRefund,
            piId 
          });

          // Update order status to REFUNDED
          try {
            await Order.updateOne(
              { gatewayPaymentId: piId },
              { $set: { status: 'REFUNDED', refundedAt: new Date() } }
            );
            console.log('✅ Order status updated to REFUNDED for PI:', piId);
          } catch (orderError) {
            console.warn('⚠️ Failed to update order status for refund:', orderError);
          }

          if (!fullRefund) {
            console.log('↩️ Partial refund detected, leaving access as-is (policy).', {
              amount, refunded: ch.amount_refunded,
            });
            break;
          }

          const sub = await findSubscriptionByPaymentIntentId(piId);
          if (!sub) {
            console.log('↩️ No linked subscription found for refunded PI', piId);
            break;
          }

          if (sub.kind === 'ONE_TIME') {
            // ✅ Update user status to REFUNDED (soft delete)
            try {
              await User.updateOne(
                { _id: sub.userId },
                { $set: { 
                  status: 'REFUNDED',
                  refundedAt: new Date(),
                  statusReason: 'full_refund_processed',
                  // Anonymize data
                  email: `deleted_${Date.now()}_${sub.userId}@deleted.com`,
                  username: `deleted_${Date.now()}_${sub.userId}`,
                  name: { first: 'Deleted', last: 'User' },
                  passwordHash: 'deleted_account'
                } }
              );
              console.log('✅ User status updated to REFUNDED due to refund');
            } catch (userError) {
              console.warn('⚠️ Failed to update user status for refund:', userError);
            }

            await cancelOneTimeEntitlement(sub._id);
            console.log('✅ ONE_TIME entitlement cancelled due to full refund', { subId: String(sub._id) });
          } else {
            console.log('ℹ️ Refunded charge is tied to a recurring subscription; not cancelling automatically.', {
              appSubId: String(sub._id), gatewaySubId: sub.gatewaySubId,
            });
          }
          break;
        }

        // Dispute Resolution Logic:
        // - 'won': Customer gets refund → REVOKE access (they didn't pay)
        // - 'lost': Customer pays → KEEP access (they paid for it)
        // - 'warning_closed': Unclear → KEEP access (conservative approach)
        case 'charge.dispute.closed': {
          const d = event.data.object as Stripe.Dispute;
          const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
          if (!piId) {
            console.log('⚖️ dispute.closed without payment_intent – skipping');
            break;
          }

          const sub = await findSubscriptionByPaymentIntentId(piId);
          if (!sub) {
            console.log('⚖️ dispute.closed: no linked subscription found for PI', piId);
            break;
          }

          const outcome = d.status; // 'won' | 'lost' | 'warning_closed'
          console.log('⚖️ Dispute closed:', { outcome, subId: String(sub._id), kind: sub.kind });

          if (outcome === 'won') {
            // Customer won dispute - they get money back, so revoke access
            if (sub.kind === 'ONE_TIME') {
              await cancelOneTimeEntitlement(sub._id);
              console.log('⛔ ONE_TIME revoked due to won dispute (customer got refund)', { subId: String(sub._id) });
            } else if (sub.kind === 'RECURRING') {
              await cancelRecurringSubscription(sub);
              console.log('⛔ RECURRING cancelled due to won dispute (customer got refund)', {
                appSubId: String(sub._id), gatewaySubId: sub.gatewaySubId,
              });
            }
          } else if (outcome === 'lost') {
            // Customer lost dispute - they keep access (they paid for it)
            console.log('✅ Customer lost dispute - keeping access as-is (they paid)', { subId: String(sub._id) });
          } else if (outcome === 'warning_closed') {
            // Warning closed - usually keep access (conservative approach)
            console.log('⚠️ Warning closed - keeping access as-is (conservative)', { subId: String(sub._id) });
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

      return res.status(200).send('ok');
    } catch (e) {
      console.error('❌ Processing failed:', e);
      await WebhookEvent.updateOne(
        { eventId: event.id },
        {
          $set: { status: 'failed', processedAt: new Date(), errorMessage: String((e as any)?.message || e) },
          $unset: { claimed: '', claimedAt: '' }, // Let a retry claim it
        }
      );
      return res.status(500).send('error');
    }
  }
);

export default router;
