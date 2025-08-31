// backend/src/lib/stripe/webhooks/utils/subscription.ts
import User from '../../../../models/user.model';
import Subscription from '../../../../models/subscription.model';
import MembershipLevel from '../../../../models/membershipLevel.model';
import Order from '../../../../models/order.model';
import { stripe } from '../../client';
import { logger } from '../../../../utils/general/logger';
import Stripe from 'stripe';
import CheckoutSession from '../../../../models/checkoutSession.model';
import { recomputeUserMembershipLevel } from '../../../../services/subscriptions';

/** Cancel a ONE_TIME entitlement in your DB (idempotent). */
export async function cancelOneTimeEntitlement(subId: any) {
  // First mark this specific entitlement cancelled
  await Subscription.updateOne(
    { _id: subId, kind: 'ONE_TIME', status: { $ne: 'CANCELLED' } },
    { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } },
    { runValidators: true }
  );

  // Then recompute based on what's left
  const sub = await Subscription.findById(subId).select('userId');
  if (sub?.userId) {
    await recomputeUserMembershipLevel(sub.userId);
  }
}

/** Cancel a Stripe subscription at end-of-period and mirror it in DB (idempotent). */
export async function cancelRecurringSubscription(sub: any) {
  try {
    if (sub.stripeSubscriptionId) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    }
  } catch (e) {
    logger.warn('Stripe sub cancel failed (continuing):', e);
  }

  // Mark locally (but keep status ACTIVE):
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { autoRenews: false, cancelDate: new Date() } },
    { runValidators: true }
  );
}

// Helper functions for subscription management
export async function findSubscriptionByPaymentIntentId(piId: string) {
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
        const sub = await Subscription.findOne({ stripeSubscriptionId: subId });
        if (sub) return sub;
      }
    }
  } catch (e) {
    logger.warn('findSubscriptionByPaymentIntentId(Invoice) failed:', e);
  }

  return null;
}

export async function resolveLevelByPriceId(priceId?: string) {
  if (!priceId) return null;
  return await MembershipLevel.findOne({ stripePriceId: priceId }).select('_id key');
}

export async function upsertDbSubscriptionFromStripeSub(s: Stripe.Subscription) {
  /**
   * Comprehensive guard system to prevent re-activation of subscriptions that should never be revived:
   * 1. SUPERSEDED subscriptions (replaced by better plans)
   * 2. Subscriptions belonging to DELETED users
   * 3. Subscriptions cancelled for account deletion (sticky-cancel)
   */
  const existingSub = await Subscription.findOne({ stripeSubscriptionId: s.id })
    .select('status cancelReason userId')
    .lean();
    
  if (existingSub?.status === 'SUPERSEDED') {
    logger.info('Subscription is superseded, skipping processing:', { 
      stripeSubscriptionId: s.id, 
      status: existingSub.status 
    });
    return existingSub;
  }

  // Guard: Never re-activate subscriptions for deleted users
  if (existingSub?.userId) {
    const user = await User.findById(existingSub.userId).select('status').lean();
    if (user?.status === 'DELETED') {
      logger.info('Subscription belongs to deleted user, skipping processing:', { 
        stripeSubscriptionId: s.id, 
        userId: existingSub.userId,
        userStatus: user.status
      });
      return existingSub;
    }
  }

  // Guard: Sticky-cancel for account deletion
  if (existingSub?.status === 'CANCELLED' && existingSub?.cancelReason === 'account_deleted') {
    logger.info('Subscription was cancelled for account deletion, skipping processing:', { 
      stripeSubscriptionId: s.id, 
      cancelReason: existingSub.cancelReason
    });
    return existingSub;
  }

  // --- Price / level resolution (handles both expanded and non-expanded)
  const item = s.items?.data?.[0];
  const priceId: string | null = item?.price?.id ?? null;

  // Try resolve MembershipLevel immediately
  const level = priceId ? await resolveLevelByPriceId(priceId) : null;

  // Derive a friendly plan name:
  // 1) Membership level key if known
  // 2) Else expanded Stripe product name (if available)
  // 3) Fallback string
  const stripeProductName =
    typeof item?.price?.product === 'object' && item?.price?.product
      ? (item.price.product as Stripe.Product).name
      : undefined;
  const planName = level?.key ?? stripeProductName ?? 'Unknown Plan';

  // --- Map Stripe status -> app status
  // Keep access during dunning (past_due) but not on unpaid unless business explicitly wants that
  const activeish = ['active', 'trialing', 'past_due'];
  const appStatus: 'ACTIVE' | 'CANCELLED' = activeish.includes(s.status) ? 'ACTIVE' : 'CANCELLED';

  // --- User resolution (priority order)
  // 1) Stripe customer id -> User.stripeCustomerId
  // 2) subscription.metadata.userId (you write this in checkout.subscription_data.metadata)
  // 3) A matching CheckoutSession (by stripeSubscriptionId) or (by customer + most recent)
  const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id || null;

  let resolvedUserId: any = null;

  if (custId) {
    const byCustomer = await User.findOne({ stripeCustomerId: custId }).select('_id').lean();
    if (byCustomer?._id) resolvedUserId = byCustomer._id;
  }

  if (!resolvedUserId && s.metadata?.userId) {
    resolvedUserId = s.metadata.userId;
  }

  if (!resolvedUserId) {
    // Try to find a CheckoutSession that produced this subscription
    // Prefer an exact stripeSubscriptionId match (handlers backfill this), else fall back by customer + mode + recent.
    const csBySub = await CheckoutSession.findOne({ stripeSubscriptionId: s.id }).select('userId').lean();
    if (csBySub?.userId) {
      resolvedUserId = csBySub.userId;
    } else if (custId) {
      const csByCustomer = await CheckoutSession.findOne({
        stripeCustomerId: custId,
        mode: 'subscription',
      }).sort({ createdAt: -1 }).select('userId').lean();
      if (csByCustomer?.userId) resolvedUserId = csByCustomer.userId;
    }
  }

  // --- Billing cycle fields (defensive)
  const currentPeriodEndTs = s.current_period_end ? s.current_period_end * 1000 : null;
  const nextBillDate = currentPeriodEndTs ? new Date(currentPeriodEndTs) : null;

  // If cancel at period end, pre-fill an endDate; if already canceled, prefer ended_at.
  const endedAtTs = (s as any).ended_at ? (s as any).ended_at * 1000 : null; // ended_at is present on deleted payloads
  const endDate =
    endedAtTs ? new Date(endedAtTs)
    : s.cancel_at_period_end && currentPeriodEndTs ? new Date(currentPeriodEndTs)
    : null;

  // Compute start date safely (avoid NaN)
  const startTs =
    (typeof s.start_date === 'number' && s.start_date > 0 ? s.start_date : s.current_period_start) || null;
  const startDate = startTs ? new Date(startTs * 1000) : new Date(); // last-resort: now

  // For recurring, default auto-renews to !cancel_at_period_end when status is live-ish
  const autoRenews = !s.cancel_at_period_end;

  // --- Upsert by Stripe subscription id (idempotent)
  const doc = await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: s.id },
    {
      $set: {
        levelId: level?._id ?? undefined,
        planName,
        kind: 'RECURRING',
        gateway: 'stripe',
        stripeStatus: s.status,
        status: appStatus,
        autoRenews,
        startDate,
        nextBillDate,
        endDate,
        ...(resolvedUserId ? { userId: resolvedUserId } : {}),
      },
      $setOnInsert: {
        // nothing else needed; above fields are also valid on insert
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  return doc;
}
