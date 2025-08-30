// backend/src/lib/stripe/webhooks/handlers/checkoutSession.ts
import { stripe } from '../../client';
import CheckoutSession from '../../../../models/checkoutSession.model';
import User from '../../../../models/user.model';
import Subscription from '../../../../models/subscription.model';
import { resolveUserFromSession } from '../utils/helpers';
import { upsertDbSubscriptionFromStripeSub } from '../utils/subscription';
import { logger } from '../../../../utils/general/logger';
import { StripeCheckoutSessionEvent } from '../types';

/**
 * Handle checkout.session.completed event
 * This event is used to link data and prepare records, not to assert payment finality
 * 
 * IMPORTANT: We do NOT mark CheckoutSessions as ready here to prevent race conditions.
 * CheckoutSessions are marked ready ONLY by financial events:
 * 
 * - invoice.payment_succeeded (for recurring subscriptions)
 * - payment_intent.succeeded (for one-time payments)
 * 
 * This ensures that sessions are only marked ready after payment is confirmed,
 * preventing premature access grants for failed payments.
 */
export async function handleCheckoutSessionCompleted(event: StripeCheckoutSessionEvent) {
  const session = event.data.object;
  logger.info('💳 checkout.session.completed', { 
    id: session.id, 
    mode: session.mode, 
    customerId: session.customer,
    metadata: session.metadata
  });

  // Retrieve session with expanded line_items for subscription processing
  const expandedSession = await stripe.checkout.sessions.retrieve(session.id, { 
    expand: ['line_items.data.price', 'payment_intent'] 
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
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
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
    const stripeSubId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    if (!stripeSubId) {
      logger.warn('checkout.session.completed: no subscription id on session yet');
      return;
    }
    
    // Always fetch the latest subscription data to ensure all fields are populated
    const s = await stripe.subscriptions.retrieve(stripeSubId, {
      expand: ['items.data.price', 'items.data.price.product', 'latest_invoice.payment_intent', 'customer'],
    });

    // Ensure subscription exists and is up-to-date with latest Stripe data
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
}
