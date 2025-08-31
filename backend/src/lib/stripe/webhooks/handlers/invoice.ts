// backend/src/lib/stripe/webhooks/handlers/invoice.ts
import { stripe } from '../../client';
import User from '../../../../models/user.model';
import Order from '../../../../models/order.model';
import Subscription from '../../../../models/subscription.model';
import CheckoutSession from '../../../../models/checkoutSession.model';
import MembershipLevel from '../../../../models/membershipLevel.model';
import { sendWelcomeEmail } from '../../../../utils/email/email';
import { upsertDbSubscriptionFromStripeSub, resolveLevelByPriceId } from '../utils/subscription';
import { recomputeUserMembershipLevel, recomputeUserAccountStatus } from '../../../../services/subscriptions';
import { inferEmailFromUser } from '../utils/helpers';
import { logger } from '../../../../utils/general/logger';
import { StripeInvoiceEvent } from '../types';
import { safeActivateUser } from '../../../../utils/accounts/duplicateEmailHandler';

/**
 * Handle invoice.payment_succeeded event
 * This is the canonical event for "customer paid an invoice"
 */
export async function handleInvoicePaymentSucceeded(event: StripeInvoiceEvent) {
  const inv = event.data.object;
  logger.info('💰 invoice.payment_succeeded - START', { 
    id: inv.id, 
    subscription: inv.subscription,
    customer: inv.customer,
    amount: inv.amount_paid,
    customer_email: inv.customer_email,
    currency: inv.currency,
    status: inv.status,
    lines_count: inv.lines?.data?.length || 0
  });

  // --- Get subscription id, even if the event payload omitted it ---
  logger.info('🔍 Resolving subscription ID from invoice...');
  let sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
  if (!sid) {
    logger.info('⚠️ No subscription ID in event payload, attempting to refetch invoice...');
    try {
      const freshInv = await stripe.invoices.retrieve(inv.id, { expand: ['subscription'] });
      sid = typeof freshInv.subscription === 'string' ? freshInv.subscription : freshInv.subscription?.id;
      if (sid) {
        logger.info('✅ Successfully retrieved subscription ID from refetched invoice:', sid);
      } else {
        logger.warn('⚠️ Still no subscription ID after refetching invoice');
      }
    } catch (e) {
      logger.warn('⚠️ invoice.payment_succeeded: could not refetch invoice to get subscription', e);
    }
  } else {
    logger.info('✅ Subscription ID found in event payload:', sid);
  }

  // --- If still no sid, fall back via customer → user → latest session link (to not block "ready") ---
  const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id || null;
  logger.info('🔍 Customer ID resolved:', custId);

  let s: any = null;
  if (sid) {
    logger.info('🔄 Retrieving subscription by ID with full expansion...');
    try {
      // 1) Expand subscription properly to avoid crashes in upsertDbSubscriptionFromStripeSub
      s = await stripe.subscriptions.retrieve(sid, {
        expand: [
          'items.data.price',
          'items.data.price.product',
          'latest_invoice.payment_intent',
          'customer',
        ],
      });
      logger.info('✅ Subscription retrieved successfully:', {
        subscriptionId: s.id,
        status: s.status,
        currentPeriodEnd: s.current_period_end,
        itemsCount: s.items?.data?.length || 0
      });
    } catch (e) {
      logger.warn(`⚠️ invoice.payment_succeeded: failed to retrieve subscription by sid: ${sid}`, e);
    }
  } else if (custId) {
    logger.info('🔄 No subscription ID, attempting to find subscription by customer...');
    // Last-ditch: try to find the most recent active/trialing/past_due sub for this customer
    try {
      const list = await stripe.subscriptions.list({ customer: custId, status: 'all', limit: 1 });
      s = list.data?.[0] || null;
      if (s) {
        logger.info('✅ Found subscription by customer, expanding...');
        // Also expand the subscription from the list to avoid crashes
        s = await stripe.subscriptions.retrieve(s.id, {
          expand: [
            'items.data.price',
            'items.data.price.product',
            'latest_invoice.payment_intent',
            'customer',
          ],
        });
        sid = s?.id || undefined;
        logger.info('✅ Subscription expanded successfully:', {
          subscriptionId: s.id,
          status: s.status
        });
      } else {
        logger.info('ℹ️ No subscriptions found for customer');
      }
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
        { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
      );
    }
    return; // We can't safely write Order/Subscription without a sub snapshot
  }

  // 2) After you resolved `s` (and before upsert), also try to backfill CheckoutSession.subscriptionId
  try {
    // try direct mapping via the session id on the invoice's payment_intent (if Stripe populated it)
    const piId = typeof s?.latest_invoice?.payment_intent === 'string' 
      ? s.latest_invoice.payment_intent 
      : s?.latest_invoice?.payment_intent?.id;
    
    let csId: string | null = null;
    if (piId) {
      const list = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
      csId = list.data?.[0]?.id ?? null;
    }

    if (csId) {
      await CheckoutSession.updateOneWithValidation(
        { stripeSessionId: csId },
        { $set: { stripeSubscriptionId: sid, status: 'COMPLETED', ready: true, readyAt: new Date() } }
      );
    } else {
      // fallback by customer + recent window (e.g., last 24h, status CREATED/COMPLETED)
      await CheckoutSession.updateOneWithValidation(
        { stripeCustomerId: s.customer as string, mode: 'subscription', createdAt: { $gt: new Date(Date.now() - 24*60*60*1000) } },
        { $set: { stripeSubscriptionId: sid, status: 'COMPLETED', ready: true, readyAt: new Date() } }
      );
    }
  } catch (e) {
    logger.warn('⚠️ Could not map PI → Session to backfill subscriptionId', e);
  }

  // --- 3) Upsert local subscription ---
  let appSub: any = await Subscription.findOne({ stripeSubscriptionId: s?.id });
  if (!appSub) {
    try {
      appSub = await upsertDbSubscriptionFromStripeSub(s);
    } catch (e) {
      logger.error('❌ upsertDbSubscriptionFromStripeSub failed', e);
    }
  }
  if (!appSub) {
    logger.warn('⚠️ Missing appSub after upsert; cannot proceed with Order/ready linking');
    // As a UI backstop, mark ready by sid/cust and return:
    // Note: updateMany cannot use runValidators, but this is intentional for bulk status updates
    if (sid) await CheckoutSession.updateMany({ stripeSubscriptionId: sid }, { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } });
    if (custId) await CheckoutSession.updateMany({ stripeCustomerId: custId }, { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } });
    return;
  }

  // --- Resolve user (by customer id first, then invoice email) ---
  let user = appSub?.userId ? await User.findById(appSub.userId).select('_id email name status') : null;
  if (!user && custId) user = await User.findOne({ stripeCustomerId: custId }).select('_id email name status');
  if (!user && inv.customer_email) user = await User.findOne({ email: inv.customer_email }).select('_id email name status');
  if (!user) {
    logger.warn('⚠️ invoice.payment_succeeded: unable to resolve user; skipping Order write');
    return;
  }

  // Attach userId if missing on sub
  if (!appSub.userId) {
    await Subscription.updateOne({ _id: appSub._id }, { $set: { userId: user._id } }, { runValidators: true });
    appSub = await Subscription.findById(appSub._id);
  }

  // Ensure levelId (expand lines if needed)
  if (!appSub?.levelId) {
    try {
      const fullInv = inv.lines?.data?.length ? inv : await stripe.invoices.retrieve(inv.id, { expand: ['lines.data.price'] });
      const firstLine = fullInv.lines?.data?.[0];
      const priceId = (firstLine?.price?.id as string) || null;
      if (priceId) {
        const level = await MembershipLevel.findOne({ stripePriceId: priceId }).select('_id');
        if (level?._id) {
          await Subscription.updateOne({ _id: appSub._id }, { $set: { levelId: level._id } }, { runValidators: true });
          appSub = await Subscription.findById(appSub._id).select('levelId userId');
        }
      }
    } catch (e) {
      logger.warn('⚠️ Could not expand invoice lines to resolve level', e);
    }
    if (!appSub?.levelId) {
      logger.warn('⚠️ invoice.payment_succeeded: missing levelId even after backfill; skipping Order write');
      // Still mark ready for UI (we know it's paid)
      if (sid) {
        await CheckoutSession.updateMany({ stripeSubscriptionId: sid }, { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } });
      }
      return;
    }
  }

  // If Stripe says active/trialing/past_due, keep local ACTIVE and refresh next bill
  if (['active', 'trialing', 'past_due'].includes(s.status)) {
    await Subscription.updateOne(
      { _id: appSub._id },
      { $set: { status: 'ACTIVE', nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null } },
      { runValidators: true }
    );

    // Ensure recurring subscriptions have proper autoRenews and nextBillDate
    if (appSub.kind === 'RECURRING') {
      const updateData: any = {};
      
      // Set nextBillDate if not already set or if it's different
      if (s.current_period_end) {
        const newNextBillDate = new Date(s.current_period_end * 1000);
        if (!appSub.nextBillDate || appSub.nextBillDate.getTime() !== newNextBillDate.getTime()) {
          updateData.nextBillDate = newNextBillDate;
        }
      }
      
      // Ensure autoRenews is properly set for recurring subscriptions
      if (appSub.autoRenews === false && !s.cancel_at_period_end) {
        updateData.autoRenews = true;
      }
      
      // Update if we have changes
      if (Object.keys(updateData).length > 0) {
        await Subscription.updateOne(
          { _id: appSub._id },
          { $set: updateData },
          { runValidators: true }
        );
        logger.info('Updated recurring subscription fields:', updateData);
      }
    }

    // Promote user to ACTIVE once (gated) - skip if user is DELETED or REFUNDED
    const u = await User.findById(appSub.userId).select('status').lean();
    if (u && u.status !== 'DELETED' && u.status !== 'REFUNDED') {
      const activationResult = await safeActivateUser(appSub.userId);
      const justActivated = { modifiedCount: activationResult.modifiedCount };
      if (justActivated.modifiedCount > 0) {
        try {
          const u = await User.findById(appSub.userId).select('email name');
          if (u) await sendWelcomeEmail(u.email, `${u.name.first} ${u.name.last}`);
        } catch (e) { logger.error('❌ Welcome email failed:', e); }
      }
    }

    // Fast cache on user
    // Update user membership level cache and account status via recompute functions
    try {
      await recomputeUserMembershipLevel(appSub.userId);
      await recomputeUserAccountStatus(appSub.userId);
      logger.info('User membership level and account status recomputed after invoice payment:', { userId: appSub.userId });
    } catch (e) {
      logger.error('Post-invoice payment recompute failed:', {
        userId: appSub.userId,
        message: (e as any)?.message
      });
    }
  }

  // Upsert Order keyed by invoice id (idempotent)
  try {
    const u = await User.findById(appSub.userId).select('name email').lean();
    const billingName = inv.customer_name || (u?.name?.first && u?.name?.last ? `${u.name.first} ${u.name.last}` : 'Customer');
    await Order.updateOne(
      { gatewayInvoiceId: inv.id },
      {
        $setOnInsert: {
          userId: appSub.userId,
          subscriptionId: appSub._id,
          membershipLevelId: appSub.levelId,
          totalCents: inv.amount_paid ?? 0,
          currency: (inv.currency ?? 'usd').toLowerCase(),
          billing: { name: billingName, email: inv.customer_email || u?.email || (await inferEmailFromUser({ userId: appSub.userId.toString() })) },
          status: 'COMPLETED',
          paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date(),
        },
      },
      { upsert: true, runValidators: true }
    );
  } catch (e) {
    logger.error(`❌ Failed to upsert Order for invoice: ${inv.id}`, e);
  }

  logger.info('🎉 invoice.payment_succeeded processed successfully:', {
    invoiceId: inv.id,
    subscriptionId: sid,
    userId: appSub?.userId,
    customerId: custId,
    amount: inv.amount_paid,
    currency: inv.currency
  });
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(event: StripeInvoiceEvent) {
  const inv = event.data.object;
  logger.info('❌ invoice.payment_failed - START', { 
    id: inv.id, 
    subscription: inv.subscription,
    customer: inv.customer,
    amount: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    customer_email: inv.customer_email
  });

  const sid = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
  if (!sid) {
    logger.warn('⚠️ invoice.payment_failed: no subscription id found, skipping');
    return;
  }

  // Refresh our snapshot of the subscription; do not auto-cancel here
  // Note: Don't email failure here; that belongs in a separate notification system
  try {
    // Also expand here to avoid crashes
    const s = await stripe.subscriptions.retrieve(sid, {
      expand: [
        'items.data.price',
        'items.data.price.product',
        'latest_invoice.payment_intent',
        'customer',
      ],
    });
    await upsertDbSubscriptionFromStripeSub(s);
    logger.warn('⚠️ invoice.payment_failed: refreshed local subscription snapshot', { sid });
  } catch (e) {
    logger.warn('⚠️ invoice.payment_failed: unable to refresh subscription', e);
  }
  
  logger.info('✅ invoice.payment_failed processed successfully:', { 
    invoiceId: inv.id,
    subscriptionId: sid,
    customerId: typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
  });
}
