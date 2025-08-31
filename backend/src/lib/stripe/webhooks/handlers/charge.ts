// backend/src/lib/stripe/webhooks/handlers/charge.ts
import { stripe } from '../../client';
import User from '../../../../models/user.model';
import Order from '../../../../models/order.model';
import Subscription from '../../../../models/subscription.model';
import { findSubscriptionByPaymentIntentId, cancelOneTimeEntitlement, cancelRecurringSubscription } from '../utils/subscription';
import { logger } from '../../../../utils/general/logger';
import { StripeChargeEvent, StripeDisputeEvent } from '../types';

/**
 * Handle charge.refunded event
 * Processes refunds and updates user/subscription status accordingly
 */
export async function handleChargeRefunded(event: StripeChargeEvent) {
  const charge = event.data.object;
  logger.info('💸 charge.refunded', { 
    id: charge.id, 
    amount: charge.amount,
    refunded: charge.refunded
  });

  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  
  if (!piId) {
    logger.info('charge.refunded without payment_intent – skipping');
    return;
  }

  const amount = charge.amount ?? charge.amount_captured ?? 0;
  const fullRefund = (charge.amount_refunded ?? 0) >= amount;

  logger.info('Processing refund:', { 
    chargeId: charge.id, 
    amount, 
    refunded: charge.amount_refunded,
    fullRefund
  });

  // Update order status to REFUNDED
  try {
    await Order.updateOne(
      { gatewayPaymentId: piId },
      { $set: { status: 'REFUNDED', refundedAt: new Date() } },
      { runValidators: true }
    );
    logger.info('Order status updated to REFUNDED for PI:', piId);
  } catch (orderError) {
    logger.warn('⚠️ Failed to update order status for refund:', orderError);
  }

  if (!fullRefund) {
    logger.info('Partial refund detected, leaving access as-is (policy).', {
      amount, refunded: charge.amount_refunded,
    });
    return;
  }

  const sub = await findSubscriptionByPaymentIntentId(piId);
  if (!sub) {
    logger.info('No linked subscription found for refunded PI', piId);
    return;
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
          } },
          { runValidators: true }
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
      appSubId: String(sub._id), stripeSubscriptionId: sub.stripeSubscriptionId,
    });
  }

  // Clear user membership level cache since access has changed
  if (sub.userId) {
    await User.updateOne(
      { _id: sub.userId },
      { $unset: { membershipLevel: 1 } },
      { runValidators: true }
    );
    logger.info('Cleared user membership level cache due to refund');
  }

  logger.info('✅ charge.refunded processed successfully:', { chargeId: charge.id });
}

/**
 * Handle charge.dispute.closed event
 * Resolves disputes and handles access revocation based on outcome
 */
export async function handleChargeDisputeClosed(event: StripeDisputeEvent) {
  const d = event.data.object;
  const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
  
  if (!piId) {
    logger.info('dispute.closed without payment_intent – skipping');
    return;
  }

  const sub = await findSubscriptionByPaymentIntentId(piId);
  if (!sub) {
    logger.info('dispute.closed: no linked subscription found for PI', piId);
    return;
  }

  const outcome = d.status; // 'won' | 'lost' | 'warning_closed'
  logger.info('Dispute closed:', { outcome, subId: String(sub._id), kind: sub.kind });

  // 'lost' -> customer got the money back → revoke access
  // 'won' -> merchant keeps funds → keep access
  if (outcome === 'lost') {
    if (sub.kind === 'ONE_TIME') {
      await cancelOneTimeEntitlement(sub._id);
      logger.info('ONE_TIME revoked due to lost dispute (customer got refund)', { subId: String(sub._id) });
    } else if (sub.kind === 'RECURRING') {
      await cancelRecurringSubscription(sub);
      logger.info('RECURRING cancelled due to lost dispute (customer got refund)', {
        appSubId: String(sub._id), stripeSubscriptionId: sub.stripeSubscriptionId,
      });
    }
  } else if (outcome === 'won') {
    logger.info('Merchant won dispute - keeping access as-is.', { subId: String(sub._id) });
  } else if (outcome === 'warning_closed') {
    logger.info('Warning closed - keeping access as-is (conservative).', { subId: String(sub._id) });
  }

  logger.info('✅ charge.dispute.closed processed successfully:', { disputeId: d.id });
}
