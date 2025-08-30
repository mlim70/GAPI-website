// backend/src/lib/stripe/webhooks/utils/subscription.ts
import User from '../../../../models/user.model';
import Subscription from '../../../../models/subscription.model';
import MembershipLevel from '../../../../models/membershipLevel.model';
import Order from '../../../../models/order.model';
import { stripe } from '../../client';
import { logger } from '../../../../utils/general/logger';
import Stripe from 'stripe';
import CheckoutSession from '../../../../models/checkoutSession.model';

/**
 * Helper function to recompute user's membership level based on remaining active subscriptions
 * This ensures users don't lose access when they have multiple active subscriptions
 */
async function recomputeUserMembershipLevel(userId: any) {
  const activeSubscription = await Subscription.findOne({ 
    userId, 
    status: 'ACTIVE' 
  }).populate('levelId').sort({ 
    // Priority: RECURRING > ONE_TIME > FREE, then by creation date (newest first)
    kind: -1, // RECURRING = 2, ONE_TIME = 1, FREE = 0
    createdAt: -1 
  }).lean();

  if (activeSubscription?.levelId) {
    // User has another active subscription, set membership level accordingly
    const membershipLevel = activeSubscription.levelId as any;
    // Only update if the membership level has actually changed
    const updateResult = await User.updateOne(
      { _id: userId, membershipLevel: { $ne: membershipLevel.key } }, 
      { $set: { membershipLevel: membershipLevel.key } }
    );
    
    if (updateResult.modifiedCount > 0) {
      logger.info('Updated user membership level from remaining active subscription:', {
        userId,
        membershipLevel: membershipLevel.key,
        subscriptionId: activeSubscription._id
      });
    } else {
      logger.info('User membership level unchanged:', {
        userId,
        membershipLevel: membershipLevel.key
      });
    }
    return membershipLevel.key;
  } else {
    // No active subscriptions remain, clear membership level
    // Only clear if it's currently set
    const updateResult = await User.updateOne(
      { _id: userId, membershipLevel: { $exists: true } }, 
      { $unset: { membershipLevel: 1 } }
    );
    
    if (updateResult.modifiedCount > 0) {
      logger.info('Cleared membership level - no active subscriptions remain:', userId);
    } else {
      logger.info('User membership level already cleared:', userId);
    }
    return null;
  }
}

/** Cancel a ONE_TIME entitlement in your DB (idempotent). */
export async function cancelOneTimeEntitlement(subId: any) {
  const sub = await Subscription.findById(subId);
  if (sub?.userId) {
    // Recompute membership level instead of blindly clearing it
    // This ensures users don't lose access if they have other active subscriptions
    await recomputeUserMembershipLevel(sub.userId);
  }

  await Subscription.updateOne(
    { _id: subId, kind: 'ONE_TIME', status: { $ne: 'CANCELLED' } },
    { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
  );
}

/** Cancel a Stripe subscription immediately and mirror it in DB (idempotent). */
export async function cancelRecurringSubscription(sub: any) {
  try {
      if (sub.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  }
  } catch (e) {
    // If it's already canceled or not found, that's fine—just mirror locally.
    logger.warn('Stripe sub cancel failed (continuing):', e);
  }

  // Recompute membership level instead of blindly clearing it
  // This ensures users don't lose access if they have other active subscriptions
  if (sub.userId) {
    await recomputeUserMembershipLevel(sub.userId);
  }

  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
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
  // We keep access during dunning (past_due/unpaid), align with your handlers.
  const activeish = ['active', 'trialing', 'past_due', 'unpaid'];
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}
