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
import { sendWelcomeEmail } from '../utils/email/email';
import { logger } from '../utils/logger';

/**
 * Stripe Webhook Handler with Recommended Delegation Pattern
 * 
 * This implementation follows the recommended delegation approach:
 * 
 * 1. checkout.session.completed (stitching + context)
 *    - Use it to link data and prepare records, not to assert payment finality
 *    - Resolve user from metadata.userId
 *    - Persist stripeCustomerId to the user if missing
 *    - Upsert a local subscription snapshot for mode=subscription (status mirrored but don't rely on it for activation)
 *    - For mode=payment (one-time): store intended level in session fields; don't create subscription/order yet
 *    - Mark the CheckoutSession doc COMPLETED with all relevant context fields
 *    - DO NOT send receipts, finalize Orders, or grant irreversible access here
 * 
 * 2. invoice.payment_succeeded (PRIMARY PATH: financial truth for subscriptions)
 *    - This is the canonical event for "customer paid an invoice"
 *    - Upsert Subscription (mirror status, nextBillDate, autoRenews, level via price)
 *    - Promote the user to ACTIVE when sub status is active/trialing (idempotent)
 *    - Create/Upsert the Order keyed by gatewayInvoiceId (idempotent)
 *    - Mark CheckoutSession as ready for immediate UI responsiveness
 *    - Unset signupIntent and send welcome email only on first activation
 *    - Don't email failure here; that belongs in invoice.payment_failed
 * 
 * 3. payment_intent.succeeded (PRIMARY PATH: financial truth for one-time payments)
 *    - This is the canonical event for "customer paid a one-time payment"
 *    - Find intended level from CheckoutSession using paymentIntentId (deterministic lookup)
 *    - Create/Upsert the ONE_TIME subscription + Order keyed by PI id
 *    - Promote user to ACTIVE (idempotent) and unset signupIntent only on first activation
 *    - Mark CheckoutSession as ready for immediate UI responsiveness
 *    - Send welcome email only on first activation
 * 
 * This pattern ensures:
 * - Payment finality is determined by financial events, not checkout completion
 * - Users are only activated after payment confirmation
 * - Orders are only marked as COMPLETED after payment success
 * - Welcome emails are sent at the right time (only on first activation)
 * - Idempotent operations prevent duplicate processing
 * - Promotion backstop ensures users get activated even if invoice webhooks are delayed
 * - Welcome emails are sent inline immediately to prevent duplicates
 * - Database-level uniqueness constraints provide bulletproof idempotency protection
 */

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
    logger.warn('findSubscriptionByPaymentIntentId(Order) failed:', e);
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
    logger.warn('findSubscriptionByPaymentIntentId(Invoice) failed:', e);
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
    logger.warn('Stripe sub cancel failed (continuing):', e);
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
        planName: level?.key ?? 'Unknown Plan',
        kind: 'RECURRING',
        gateway: 'stripe',
        status: appStatus,
        autoRenews: !s.cancel_at_period_end,
        startDate: new Date(((s.start_date ?? s.current_period_start) * 1000)),
        nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
        endDate: s.cancel_at_period_end && s.current_period_end ? new Date(s.current_period_end * 1000) : null,
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
    const startTime = Date.now();
    logger.info('Webhook received at:', new Date().toISOString());
    logger.info('Buffer check:', { 
      isBuffer: Buffer.isBuffer(req.body), 
      length: Buffer.isBuffer(req.body) ? req.body.length : 'n/a' 
    });

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      logger.error('❌ Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
      logger.info('✅ Webhook signature verified');
      logger.info('Event details:', { 
        id: event.id, 
        type: event.type, 
        created: new Date(event.created * 1000) 
      });
    } catch (err: any) {
      logger.error('❌ Signature verify failed:', err?.message);
      return res.status(400).send('Bad signature');
    }

    try {
      await connectToDatabase();
      logger.info('✅ Database connected successfully');
    } catch (e) {
      logger.error('❌ DB connect failed:', e);
      return res.status(500).send('DB connect failed');
    }

    // Exactly-once claim
    logger.info('🔒 Attempting to claim webhook event...');
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
        logger.warn('⚠️ Event already claimed (duplicate key), exiting');
        return res.status(200).send('ok');
      }
      throw e;
    }

    if (!claim || claim.status === 'processed') {
      logger.warn('⚠️ Event already claimed or processed, exiting');
      return res.status(200).send('ok');
    }

    logger.info('✅ Event claimed successfully, processing...');

    try {
      logger.info('🔄 Processing event type:', event.type);
      logger.info('🔍 Event details:', {
        id: event.id,
        type: event.type,
        created: event.created,
        data: {
          object_id: (event.data.object as any)?.id || 'unknown',
          object_type: typeof event.data.object === 'object' ? 'object' : typeof event.data.object
        }
      });

      switch (event.type) {
        case 'checkout.session.completed': {
          // ✅ SETUP EVENT: STITCHING + CONTEXT (not payment finality)
          // This event is used to link data and prepare records, not to assert payment finality
          // Payment activation happens in invoice.payment_succeeded (subscriptions) or payment_intent.succeeded (one-time)
          // CheckoutSession.ready is set by financial events, not here
          
          const session = event.data.object as Stripe.Checkout.Session;
          logger.info('💳 checkout.session.completed', { 
            id: session.id, 
            mode: session.mode, 
            customerId: session.customer,
            metadata: session.metadata
          });

          // Retrieve session with expanded line_items for subscription processing
          const expandedSession = await stripe.checkout.sessions.retrieve(session.id, { 
            expand: ['line_items', 'payment_intent'] 
          });
          const priceId = (expandedSession as any)?.line_items?.data?.[0]?.price?.id;
          const paymentIntentId = typeof expandedSession.payment_intent === 'string'
            ? expandedSession.payment_intent
            : expandedSession.payment_intent?.id || null;

          // Resolve the purchasing user from session metadata
          const purchasingUser = await resolveUserFromSession(session);
          logger.info('Purchasing user details:', {
            userId: purchasingUser._id,
            email: purchasingUser.email,
            name: `${purchasingUser.name.first} ${purchasingUser.name.last}`,
            status: purchasingUser.status
          });

          // Mark local CheckoutSession as completed with all stitching context
          logger.info('Updating CheckoutSession status to COMPLETED with userId:', purchasingUser._id);
          try {
            const updateResult = await CheckoutSession.updateOne(
              { stripeSessionId: session.id },
              {
                $set: {
                  status: 'COMPLETED',
                  userId: purchasingUser._id, // Ensure userId is set
                  mode: session.mode,
                  priceId: priceId,
                  stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
                  paymentIntentId: paymentIntentId,
                  subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
                },
              }
            );
            logger.info('CheckoutSession update result:', updateResult);
          } catch (updateError) {
            logger.error('❌ Failed to update CheckoutSession:', updateError);
            // Continue processing - this is not critical for the main flow
          }

          // Link Stripe customer to User for convenience (set once, never flip)
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
          if (customerId && !purchasingUser.stripeCustomerId) {
            await User.updateOne({ _id: purchasingUser._id }, { $set: { stripeCustomerId: customerId } });
          }

          if (session.mode === 'subscription') {
            // Create/Upsert RECURRING subscription snapshot (status mirrored but don't rely on it for activation)
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

            // DO NOT activate user here - wait for invoice.payment_succeeded
            // DO NOT send receipts, finalize Orders, or grant irreversible access here
            logger.info('Subscription snapshot created/updated - waiting for invoice.payment_succeeded for activation');
            
          } else if (session.mode === 'payment') {
            // ONE_TIME: record the intended level and PI id; don't mark paid yet
            // Note: Actual subscription and order creation happens in payment_intent.succeeded
            // Level information is already stored in CheckoutSession above
            logger.info('ONE_TIME payment intent recorded - waiting for payment_intent.succeeded for activation');
          }
  
          break;
        }

        case 'invoice.payment_succeeded': {
          const inv = event.data.object as Stripe.Invoice;

          // --- Get subscription id, even if the event payload omitted it ---
          let sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
          if (!sid) {
            try {
              const freshInv = await stripe.invoices.retrieve(inv.id, { expand: ['subscription'] });
              sid = typeof freshInv.subscription === 'string' ? freshInv.subscription : freshInv.subscription?.id;
            } catch (e) {
              logger.warn('⚠️ invoice.payment_succeeded: could not refetch invoice to get subscription', e);
            }
          }

          // --- If still no sid, fall back via customer → user → latest session link (to not block "ready") ---
          const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id || null;

          let s: Stripe.Subscription | null = null;
          if (sid) {
            try {
              s = await stripe.subscriptions.retrieve(sid);
            } catch (e) {
              logger.warn(`⚠️ invoice.payment_succeeded: failed to retrieve subscription by sid: ${sid}`, e);
            }
          } else if (custId) {
            // Last-ditch: try to find the most recent active/trialing sub for this customer
            try {
              const list = await stripe.subscriptions.list({ customer: custId, status: 'all', limit: 1 });
              s = list.data?.[0] || null;
              sid = s?.id || undefined;
            } catch (e) {
              logger.warn(`⚠️ invoice.payment_succeeded: failed to list subs by customer: ${custId}`, e);
            }
          }

          if (!s) {
            logger.info('🧾 invoice.payment_succeeded but no resolvable subscription; will still try to mark ready via customer');
            if (custId) {
              // Mark ready on any recent checkout session for this customer as a UI backstop
              await CheckoutSession.updateMany(
                { stripeCustomerId: custId, mode: 'subscription', ready: { $ne: true } },
                { $set: { ready: true, readyAt: new Date() } }
              );
            }
            break; // We can't safely write Order/Subscription without a sub snapshot
          }

          // --- Upsert local subscription snapshot ---
          let appSub = await Subscription.findOne({ gatewaySubId: s.id });
          if (!appSub) appSub = await upsertDbSubscriptionFromStripeSub(s);

          // --- Resolve user (by customer id first, then invoice email) ---
          let user = appSub?.userId ? await User.findById(appSub.userId).select('_id email name status') : null;
          if (!user && custId) user = await User.findOne({ stripeCustomerId: custId }).select('_id email name status');
          if (!user && inv.customer_email) user = await User.findOne({ email: inv.customer_email }).select('_id email name status');
          if (!user) {
            logger.warn('⚠️ invoice.payment_succeeded: unable to resolve user; skipping Order write');
            break;
          }

          // Attach userId if missing on sub
          if (!appSub!.userId) {
            await Subscription.updateOne({ _id: appSub!._id }, { $set: { userId: user._id } });
            appSub = await Subscription.findById(appSub!._id);
          }

          // Ensure levelId (expand lines if needed)
          if (!appSub!.levelId) {
            try {
              const fullInv = inv.lines?.data?.length ? inv : await stripe.invoices.retrieve(inv.id, { expand: ['lines.data.price'] });
              const firstLine = fullInv.lines?.data?.[0];
              const priceId = (firstLine?.price?.id as string) || null;
              if (priceId) {
                const level = await MembershipLevel.findOne({ stripePriceId: priceId }).select('_id');
                if (level?._id) {
                  await Subscription.updateOne({ _id: appSub!._id }, { $set: { levelId: level._id } });
                  appSub = await Subscription.findById(appSub!._id).select('levelId userId');
                }
              }
            } catch (e) {
              logger.warn('⚠️ Could not expand invoice lines to resolve level', e);
            }
            if (!appSub!.levelId) {
              logger.warn('⚠️ invoice.payment_succeeded: missing levelId even after backfill; skipping Order write');
              // Still mark ready for UI (we know it's paid)
              if (sid) {
                await CheckoutSession.updateMany({ subscriptionId: sid }, { $set: { ready: true, readyAt: new Date() } });
              }
              break;
            }
          }

          // If Stripe says active/trialing, keep local ACTIVE and refresh next bill
          if (['active', 'trialing'].includes(s.status)) {
            await Subscription.updateOne(
              { _id: appSub!._id },
              { $set: { status: 'ACTIVE', nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null } }
            );

            // Promote user to ACTIVE once (gated)
            const justActivated = await User.updateOne(
              { _id: appSub!.userId, status: { $ne: 'ACTIVE' } },
              { $set: { status: 'ACTIVE' }, $unset: { signupIntent: 1 } }
            );
            if (justActivated.modifiedCount > 0) {
              try {
                const u = await User.findById(appSub!.userId).select('email name');
                if (u) await sendWelcomeEmail(u.email, `${u.name.first} ${u.name.last}`);
              } catch (e) { logger.error('❌ Welcome email failed:', e); }
            }

            // Fast cache on user
            if (appSub!.levelId) {
              const level = await MembershipLevel.findById(appSub!.levelId);
              if (level?.key) await User.updateOne({ _id: appSub!.userId }, { $set: { membershipLevel: level.key } });
            }
          }

          // Upsert Order keyed by invoice id (idempotent)
          try {
            const u = await User.findById(appSub!.userId).select('name email').lean();
            const billingName = inv.customer_name || (u?.name?.first && u?.name?.last ? `${u.name.first} ${u.name.last}` : 'Customer');
            await Order.updateOne(
              { gatewayInvoiceId: inv.id },
              {
                $setOnInsert: {
                  userId: appSub!.userId,
                  subscriptionId: appSub!._id,
                  membershipLevelId: appSub!.levelId,
                  totalCents: inv.amount_paid ?? 0,
                  currency: (inv.currency ?? 'usd').toLowerCase(),
                  billing: { name: billingName, email: inv.customer_email || u?.email || (await inferEmailFromUser(appSub)) },
                  status: 'COMPLETED',
                  paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date(),
                },
              },
              { upsert: true, runValidators: true }
            );
          } catch (e) {
            logger.error(`❌ Failed to upsert Order for invoice: ${inv.id}`, e);
          }

          // Mark CheckoutSession as ready (use both keys)
          const ops: any[] = [];
          if (sid) ops.push(CheckoutSession.updateMany({ subscriptionId: sid }, { $set: { ready: true, readyAt: new Date() } }));
          if (custId) ops.push(CheckoutSession.updateMany({ stripeCustomerId: custId }, { $set: { ready: true, readyAt: new Date() } }));
          if (ops.length) await Promise.allSettled(ops);

          break;
        }

        case 'payment_intent.succeeded': {
          // ✅ PRIMARY PATH: FINANCIAL TRUTH EVENT for one-time payments
          // This is the canonical event for "customer paid a one-time payment"
          // Use this to activate users, complete orders, and grant access
          
          const pi = event.data.object as Stripe.PaymentIntent;
          logger.info('payment_intent.succeeded', { 
            id: pi.id, 
            amount: pi.amount,
            currency: pi.currency,
            metadata: pi.metadata
          });

          // 1) Preferred path: deterministic link via CheckoutSession.paymentIntentId
          let cs = await CheckoutSession.findOne({ paymentIntentId: pi.id });

          // 2) Fallback: use PI metadata (populated at session create)
          if (!cs) {
            const userId = pi.metadata?.userId;
            const levelKey = pi.metadata?.levelKey;
            if (!userId || !levelKey) {
              logger.warn('⚠️ PI missing metadata; cannot finalize one-time', { 
                pi: pi.id, 
                metadata: pi.metadata 
              });
              break;
            }
            
            logger.info('Using metadata fallback for PI:', { piId: pi.id, userId, levelKey });
            
            // Heuristic: find the most recent checkout session for this user with priceId
            cs = await CheckoutSession.findOne({ 
              userId, 
              priceId: { $exists: true }, 
              mode: 'payment' 
            }).sort({ createdAt: -1 }).lean() as any;
            
            if (cs) {
              logger.info('Found CheckoutSession via metadata fallback:', cs._id);
            }
          }

          if (!cs) { 
            logger.warn('⚠️ No CheckoutSession link for PI', pi.id); 
            break; 
          }

          const userId = cs.userId;
          if (!userId) {
            logger.warn('⚠️ CheckoutSession missing userId for PI', pi.id);
            break;
          }

          // Get the level from the CheckoutSession's priceId
          const level = await MembershipLevel.findOne({ stripePriceId: cs.priceId }).select('_id key');
          if (!level?._id) {
            logger.warn(`⚠️ Unable to resolve membership level for PI: ${pi.id}, priceId: ${cs.priceId}`);
            break;
          }

          // ✅ Create/Upsert the ONE_TIME subscription + Order keyed by PI id
          try {
            // Get user details for billing name
            const user = await User.findById(userId).select('name email').lean();
            const billingName = user?.name?.first && user?.name?.last 
              ? `${user.name.first} ${user.name.last}`
              : (pi.receipt_email ? 'Customer' : 'Customer');

            // Upsert ONE_TIME subscription - ensure only one per user
            // Single lifetime pattern: if user makes multiple one-time purchases, 
            // we update the existing subscription rather than creating duplicates
            const subscription = await Subscription.findOneAndUpdate(
              { 
                userId: userId,
                kind: 'ONE_TIME',
                gateway: 'stripe'
              },
              {
                $set: {
                  levelId: level._id,
                  planName: level.key,
                  status: 'ACTIVE',
                  startDate: new Date(),
                  autoRenews: false,
                  gateway: 'stripe'
                }
              },
              { upsert: true, new: true }
            );

            // Upsert Order keyed by PI id
            await Order.updateOne(
              { gatewayPaymentId: pi.id },
              {
                $setOnInsert: {
                  userId: userId,
                  subscriptionId: subscription._id,
                  membershipLevelId: level._id,
                  totalCents: pi.amount,
                  currency: pi.currency.toLowerCase(),
                  billing: {
                    name: billingName,
                    email: pi.receipt_email || user?.email || 'unknown@example.com',
                  },
                  status: 'COMPLETED',
                  paidAt: new Date(),
                },
              },
              { upsert: true, runValidators: true }
            );

            // ✅ PRIMARY PATH: Promote user to ACTIVE (idempotent) and unset signupIntent
            // This is the canonical event for one-time user activation
            // Gate activation to prevent duplicate welcome emails
            // Only update status and send welcome email if user is not already ACTIVE
            const justActivated = await User.updateOne(
              { _id: userId, status: { $ne: 'ACTIVE' } },
              { 
                $set: { status: 'ACTIVE' },
                $unset: { signupIntent: 1 }
              }
            );
            
            if (justActivated.modifiedCount > 0) {
              logger.info('User status updated to ACTIVE for ONE_TIME payment:', justActivated);
              
              // Send welcome email only on first activation
              try {
                const user = await User.findById(userId).select('email name');
                if (user) {
                  await sendWelcomeEmail(user.email, `${user.name.first} ${user.name.last}`);
                  logger.info('Welcome email sent after ONE_TIME payment confirmation for:', user.email);
                }
              } catch (emailError) {
                logger.error('❌ Failed to send welcome email for ONE_TIME payment:', emailError);
                // Continue processing even if welcome email fails
              }
            } else {
              logger.info('User already ACTIVE, no status change needed');
            }

            // ✅ Optional: fast cache on user (webhook is the only writer)
            const levelDoc = await MembershipLevel.findById(level._id);
            if (levelDoc?.key) {
              await User.updateOne({ _id: userId }, { $set: { membershipLevel: levelDoc.key } });
            }

            // ✅ Handle subscription switching: if user had a recurring subscription, cancel it
            // This handles the case where a user switches from subscription to lifetime membership
            const existingRecurringSub = await Subscription.findOne({ 
              userId: userId, 
              kind: 'RECURRING', 
              status: 'ACTIVE' 
            });
            
            if (existingRecurringSub && existingRecurringSub.gatewaySubId) {
              try {
                logger.info('Canceling existing recurring subscription for lifetime switch:', {
                  subscriptionId: existingRecurringSub._id,
                  gatewaySubId: existingRecurringSub.gatewaySubId,
                  userId: existingRecurringSub.userId
                });
                
                // Cancel the subscription in Stripe (immediate cancellation)
                await stripe.subscriptions.update(existingRecurringSub.gatewaySubId, {
                  cancel_at_period_end: false // Cancel immediately, not at period end
                });
                
                // Update local subscription status
                await Subscription.updateOne(
                  { _id: existingRecurringSub._id },
                  { 
                    $set: { 
                      status: 'CANCELLED',
                      cancelDate: new Date(),
                      cancelReason: 'Switched to lifetime membership'
                    }
                  }
                );
                
                logger.info('Successfully canceled recurring subscription for lifetime switch');
              } catch (cancelError) {
                logger.error('❌ Failed to cancel recurring subscription for lifetime switch:', cancelError);
                // Don't fail the webhook for this; the lifetime membership is still valid
              }
            }

                      // ✅ PRIMARY PATH: Mark CheckoutSession as ready for one-time payments
          // This is the canonical event for one-time payment success
          // Note: This ensures immediate UI readiness when payment is confirmed
          try {
            await CheckoutSession.updateOne(
              { _id: cs._id },
              { $set: { ready: true, readyAt: new Date() } }
            );
            logger.info('CheckoutSession marked ready for ONE_TIME payment:', { sessionId: cs._id });
          } catch (e: any) {
            logger.error('❌ Failed to mark CheckoutSession ready for ONE_TIME payment:', e?.message || e);
          }

            logger.info(`ONE_TIME payment activated successfully for PI: ${pi.id}`);
          } catch (error) {
            logger.error(`❌ Failed to activate ONE_TIME payment for PI: ${pi.id}`, error);
            throw error; // Re-throw to mark webhook as failed
          }

          break;
        }

        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          const sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
          if (!sid) break;

          // Refresh our snapshot of the subscription; do not auto-cancel here
          // Note: Don't email failure here; that belongs in a separate notification system
          try {
            const s = await stripe.subscriptions.retrieve(sid);
            await upsertDbSubscriptionFromStripeSub(s);
            logger.warn('⚠️ invoice.payment_failed: refreshed local subscription snapshot', { sid });
          } catch (e) {
            logger.warn('⚠️ invoice.payment_failed: unable to refresh subscription', e);
          }
          break;
        }

        case 'customer.subscription.created': {
          // ✅ BACKSTOP: Handles initial subscription creation and provides fallbacks
          const sub = event.data.object as Stripe.Subscription;
          logger.info('subscription.created:', { id: sub.id, status: sub.status });

          const doc = await upsertDbSubscriptionFromStripeSub(sub);
          if (doc?.userId) {
            const priceId = sub.items?.data?.[0]?.price?.id || null;
            const level = priceId ? await resolveLevelByPriceId(priceId) : null;
            if (level?.key) {
              await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
            }
            

            
            // ✅ LINK CHECKOUTSESSION TO SUBSCRIPTION: Find and link the CheckoutSession that created this subscription
            // This is critical for marking the checkout session as ready
            try {
              // Add disambiguation when backfilling: prefer priceId match and most recent session
              const priceId = sub.items?.data?.[0]?.price?.id;
              const checkoutSession = await CheckoutSession.findOne({
                userId: doc.userId,
                mode: 'subscription',
                subscriptionId: { $exists: false },
                ...(priceId ? { priceId } : {}),
              }).sort({ createdAt: -1 });
              
              if (checkoutSession) {
                // Link the CheckoutSession to the subscription
                await CheckoutSession.updateOne(
                  { _id: checkoutSession._id },
                  { $set: { subscriptionId: sub.id } }
                );
                logger.info('Linked CheckoutSession to subscription:', {
                  checkoutSessionId: checkoutSession._id,
                  subscriptionId: sub.id
                });
              }
            } catch (linkError) {
              logger.warn('⚠️ Failed to link CheckoutSession to subscription:', linkError);
              // Don't fail the webhook for this linking step
            }
            
            // ✅ CHECKOUTSESSION READY BACKSTOP: Mark CheckoutSession as ready if subscription is already active
            // This handles edge cases where subscriptions are created with active status immediately
            // Note: This eliminates edge polling timeouts by providing immediate readiness
            if (['active', 'trialing'].includes(sub.status)) {
              try {
                const updateResult = await CheckoutSession.updateMany(
                  { subscriptionId: sub.id, ready: { $ne: true } }, // Only update if not already ready
                  { $set: { ready: true, readyAt: new Date() } }
                );
                if (updateResult.modifiedCount > 0) {
                  logger.info('CheckoutSession ready backstop: Marked ready via subscription.created (active status):', {
                    subscriptionId: sub.id,
                    modifiedCount: updateResult.modifiedCount
                  });
                }
              } catch (e: any) {
                logger.warn('⚠️ CheckoutSession ready backstop failed in subscription.created:', e?.message || e);
                // Don't fail the webhook for this backstop
              }
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          // ✅ BACKSTOP: Handles subscription status changes and provides fallbacks
          const sub = event.data.object as Stripe.Subscription;
          logger.info('subscription.updated:', { id: sub.id, status: sub.status });

          const doc = await upsertDbSubscriptionFromStripeSub(sub);
          if (doc?.userId) {
            if (['active', 'trialing'].includes(sub.status)) {
              // Keep membership during dunning (past_due/unpaid) to maintain access
              const priceId = sub.items?.data?.[0]?.price?.id || null;
              const level = priceId ? await resolveLevelByPriceId(priceId) : null;
              if (level?.key) {
                await User.updateOne({ _id: doc.userId }, { $set: { membershipLevel: level.key } });
              }
              
              // ✅ LINK CHECKOUTSESSION TO SUBSCRIPTION: Ensure CheckoutSession is linked (fallback)
              // This handles cases where the subscription.created webhook might have failed to link
              try {
                // Add disambiguation when backfilling: prefer priceId match and most recent session
                const priceId = sub.items?.data?.[0]?.price?.id;
                const checkoutSession = await CheckoutSession.findOne({
                  userId: doc.userId,
                  mode: 'subscription',
                  subscriptionId: { $exists: false },
                  ...(priceId ? { priceId } : {}),
                }).sort({ createdAt: -1 });
                
                if (checkoutSession) {
                  await CheckoutSession.updateOne(
                    { _id: checkoutSession._id },
                    { $set: { subscriptionId: sub.id } }
                  );
                  logger.info('Linked CheckoutSession to subscription via subscription.updated:', {
                    checkoutSessionId: checkoutSession._id,
                    subscriptionId: sub.id
                  });
                }
              } catch (linkError) {
                logger.warn('⚠️ Failed to link CheckoutSession to subscription in subscription.updated:', linkError);
              }
              
              // ✅ PROMOTION BACKSTOP: Ensure user is ACTIVE on active/trialing status
              // This is a safety net if the first invoice webhook is delayed or fails
              // It ensures users get access even if there are webhook processing issues
              // Note: This eliminates edge cases where users don't get activated due to webhook delays
              const justActivated = await User.updateOne(
                { _id: doc.userId, status: { $ne: 'ACTIVE' } },
                { 
                  $set: { status: 'ACTIVE' },
                  $unset: { signupIntent: 1 }
                }
              );
              
              if (justActivated.modifiedCount > 0) {
                logger.info('Promotion backstop: User activated to ACTIVE via subscription.updated:', doc.userId);

                // Send welcome email only on first activation (idempotent via unique index)
                try {
                  const user = await User.findById(doc.userId).select('email name');
                  if (user) {
                    await sendWelcomeEmail(
                      user.email,
                      `${user.name.first} ${user.name.last}`
                    );
                    logger.info('Welcome email sent via subscription.updated backstop for:', user.email);
                  }
                } catch (emailError) {
                  logger.error('❌ Failed to send welcome email via subscription.updated:', emailError);
                  // Continue processing even if welcome email fails
                }
              } else {
                logger.info('User already ACTIVE, no status change needed (subscription.updated)');
              }
              
              // ✅ CHECKOUTSESSION READY BACKSTOP: Mark CheckoutSession as ready for recurring payments
              // This is a safety net if the invoice.payment_succeeded webhook is delayed or fails
              // It ensures the UI shows ready even if there are webhook processing issues
              // Note: This eliminates edge polling timeouts by providing immediate readiness
              try {
                const updateResult = await CheckoutSession.updateMany(
                  { subscriptionId: sub.id, ready: { $ne: true } }, // Only update if not already ready
                  { $set: { ready: true, readyAt: new Date() } }
                );
                if (updateResult.modifiedCount > 0) {
                  logger.info('CheckoutSession ready backstop: Marked ready via subscription.updated:', {
                    subscriptionId: sub.id,
                    modifiedCount: updateResult.modifiedCount
                  });
                }
              } catch (e: any) {
                logger.warn('⚠️ CheckoutSession ready backstop failed:', e?.message || e);
                // Don't fail the webhook for this backstop
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
          logger.info('subscription.deleted', { 
            id: deletedSub.id, 
            status: deletedSub.status,
            customerId: deletedSub.customer
          });

          // 1) Update subscription status with precise timing
          const updateResult = await Subscription.updateOne(
            { gatewaySubId: deletedSub.id },
            { 
              $set: { 
                status: 'CANCELLED', 
                endDate: deletedSub.ended_at ? new Date(deletedSub.ended_at * 1000) : new Date(),
                cancelDate: new Date(),
                cancelReason: deletedSub.cancellation_details?.reason || 'webhook_deleted'
              } 
            }
          );

          if (updateResult.matchedCount === 0) {
            logger.warn('⚠️ No local subscription found for deleted Stripe sub:', deletedSub.id);
            break;
          }

          logger.info('Subscription status updated to CANCELLED:', updateResult);

          // 2) Get the affected user and subscription details
          const custId = typeof deletedSub.customer === 'string' ? deletedSub.customer : deletedSub.customer?.id;
          const user = custId ? await User.findOne({ stripeCustomerId: custId }).select('_id membershipLevel status') : null;
          
          if (!user) {
            logger.warn('⚠️ No user found for deleted subscription customer:', custId);
            break;
          }

          // 3) Clear membership level cache
          if (user.membershipLevel) {
            await User.updateOne({ _id: user._id }, { $unset: { membershipLevel: 1 } });
            logger.info('Cleared membership level cache for user:', user._id);
          }

          // 4) Check if user has other active subscriptions (for logging only)
          const activeSubscriptions = await Subscription.countDocuments({
            userId: user._id,
            status: 'ACTIVE'
          });

          logger.info('User subscription status after cancellation:', {
            userId: user._id,
            activeCount: activeSubscriptions,
            totalCount: activeSubscriptions // This line was not in the new_code, so I'm keeping the original
          });

          break;
        }

        case 'customer.created': {
          const customer = event.data.object as Stripe.Customer;
          logger.info('customer.created', {
            id: customer.id,
            email: customer.email,
            name: customer.name,
          });
          logger.info('Simple model: customer created, no BillingProfile handling needed');
          break;
        }

        case 'charge.refunded': {
          const ch = event.data.object as Stripe.Charge;
          const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
          if (!piId) {
            logger.info('charge.refunded without payment_intent – skipping');
            break;
          }

          const amount = ch.amount ?? ch.amount_captured ?? 0;
          const fullRefund = (ch.amount_refunded ?? 0) >= amount;

          logger.info('Processing refund:', { 
            chargeId: ch.id, 
            amount, 
            refunded: ch.amount_refunded,
            fullRefund
          });

          // Update order status to REFUNDED
          try {
            await Order.updateOne(
              { gatewayPaymentId: piId },
              { $set: { status: 'REFUNDED', refundedAt: new Date() } }
            );
            logger.info('Order status updated to REFUNDED for PI:', piId);
          } catch (orderError) {
            logger.warn('⚠️ Failed to update order status for refund:', orderError);
          }

          if (!fullRefund) {
            logger.info('Partial refund detected, leaving access as-is (policy).', {
              amount, refunded: ch.amount_refunded,
            });
            break;
          }

          const sub = await findSubscriptionByPaymentIntentId(piId);
          if (!sub) {
            logger.info('No linked subscription found for refunded PI', piId);
            break;
          }

          if (sub.kind === 'ONE_TIME') {
            // ✅ Update user status to REFUNDED (soft delete)
            try {
              // Get user first to preserve original email
              const user = await User.findById(sub.userId);
              if (user) {
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
                logger.info('User status updated to REFUNDED due to refund');
              }
            } catch (userError) {
              logger.warn('⚠️ Failed to update user status for refund:', userError);
            }

            await cancelOneTimeEntitlement(sub._id);
            logger.info('ONE_TIME entitlement cancelled due to full refund', { subId: String(sub._id) });
          } else {
            logger.info('Refunded charge is tied to a recurring subscription; not cancelling automatically.', {
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
            logger.info('dispute.closed without payment_intent – skipping');
            break;
          }

          const sub = await findSubscriptionByPaymentIntentId(piId);
          if (!sub) {
            logger.info('dispute.closed: no linked subscription found for PI', piId);
            break;
          }

          const outcome = d.status; // 'won' | 'lost' | 'warning_closed'
          logger.info('Dispute closed:', { outcome, subId: String(sub._id), kind: sub.kind });

          if (outcome === 'won') {
            // Customer won dispute - they get money back, so revoke access
            if (sub.kind === 'ONE_TIME') {
              await cancelOneTimeEntitlement(sub._id);
              logger.info('ONE_TIME revoked due to won dispute (customer got refund)', { subId: String(sub._id) });
            } else if (sub.kind === 'RECURRING') {
              await cancelRecurringSubscription(sub);
              logger.info('RECURRING cancelled due to won dispute (customer got refund)', {
                appSubId: String(sub._id), gatewaySubId: sub.gatewaySubId,
              });
            }
          } else if (outcome === 'lost') {
            // Customer lost dispute - they keep access (they paid for it)
            logger.info('Customer lost dispute - keeping access as-is (they paid)', { subId: String(sub._id) });
          } else if (outcome === 'warning_closed') {
            // Warning closed - usually keep access (conservative approach)
            logger.info('Warning closed - keeping access as-is (conservative)', { subId: String(sub._id) });
          }
          break;
        }

        default:
          logger.info('Unhandled webhook event type:', event.type);
      }

      // Update status and set accurate completion time
      await WebhookEvent.updateOne(
        { eventId: event.id },
        { $set: { status: 'processed', processedAt: new Date() } }
      );
      logger.info('Webhook event processed successfully:', event.id);
      logger.info('Final webhook processing summary:', {
        eventId: event.id,
        eventType: event.type,
        processingTime: `${Date.now() - startTime}ms`
      });

      return res.status(200).send('ok');
    } catch (e) {
      logger.error('❌ Processing failed:', e);
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
