// backend/src/lib/stripe/webhooks/handlers/paymentIntent.ts
import Stripe from 'stripe';
import { stripe } from '../../client';
import User from '../../../../models/user.model';
import Order from '../../../../models/order.model';
import Subscription from '../../../../models/subscription.model';
import CheckoutSession from '../../../../models/checkoutSession.model';
import MembershipLevel from '../../../../models/membershipLevel.model';
import { sendWelcomeEmail } from '../../../../utils/email/email';
import { resolveLevelByPriceId } from '../utils/subscription';
import { logger } from '../../../../utils/general/logger';
import { StripePaymentIntentEvent } from '../types';

/**
 * Handle payment_intent.succeeded event
 * This is the canonical event for "customer paid a one-time payment"
 */
export async function handlePaymentIntentSucceeded(event: StripePaymentIntentEvent) {
  const pi = event.data.object;
  logger.info('💳 payment_intent.succeeded', { id: pi.id, customer: pi.customer, amount: pi.amount, metadata: pi.metadata });

  // 🚧 HARD GUARDS:
  // 1) If this PI is tied to an invoice, it is a subscription payment → let invoice webhooks handle it.
  if (pi.invoice) {
    logger.info('🔕 PI belongs to an invoice (subscription). Deferring to invoice.payment_succeeded.', {
      piId: pi.id,
      invoice: typeof pi.invoice === 'string' ? pi.invoice : pi.invoice?.id
    });
    return;
  }

  // 2) Look up a Checkout Session by this PI and check its mode.
  let sess: Stripe.Checkout.Session | null = null;
  try {
    const list = await stripe.checkout.sessions.list({
      payment_intent: pi.id,
      limit: 1,
      expand: ['data.line_items.data.price', 'data.customer'],
    });
    sess = list.data?.[0] ?? null;
  } catch (e) {
    logger.warn('⚠️ PI→Session list failed', { pi: pi.id, err: e });
  }

  if (sess?.mode === 'subscription') {
    logger.info('🔕 PI is from a subscription-mode checkout. Deferring to invoice.payment_succeeded.', {
      piId: pi.id, sessionId: sess.id
    });
    return;
  }

  // --- B) Backfill / create the CheckoutSession doc as needed
  let cs = await CheckoutSession.findOne({ stripeSessionId: sess?.id ?? '__none__' });

  const stripeCustomerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null;

  if (!cs && sess?.id) {
    const userId = pi.metadata?.userId;
    cs = await CheckoutSession.findOneAndUpdate(
      { stripeSessionId: sess.id },
      {
        $setOnInsert: {
          userId,
          mode: sess.mode, // ✅ use real mode from Stripe
          levelKey: pi.metadata?.levelKey ?? null,
          createdAt: new Date(),
        },
        $set: {
          paymentIntentId: pi.id,
          stripeCustomerId,
          priceId: (sess.line_items?.data?.[0]?.price?.id as string) || undefined,
        },
      },
      { upsert: true, new: true }
    );
  } else if (!cs && !sess?.id) {
    // No session found → cannot confidently create a ONE_TIME record here.
    logger.info('ℹ️ No Checkout Session found for PI; skipping CS backfill for safety.', { pi: pi.id });
  } else if (cs && !cs.paymentIntentId) {
    await CheckoutSession.updateOne(
      { _id: cs._id },
      {
        $set: {
          paymentIntentId: pi.id,
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
        },
      }
    );
  }

  // --- C) Resolve level from Stripe or DB fallback
  let priceId: string | undefined =
    (sess?.line_items?.data?.[0]?.price?.id as string | undefined) ||
    (cs?.priceId as string | undefined);

  // Last fallback: expand PI → latest_charge.invoice.lines for price
  let piExpansionTried = false;
  if (!priceId) {
    try {
      const piFull = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ['latest_charge.invoice.lines.data.price'],
      });
      const li = (piFull.latest_charge as any)?.invoice?.lines?.data?.[0];
      priceId = li?.price?.id || undefined;
      piExpansionTried = true;
    } catch (e) {
      logger.warn('⚠️ Fallback PI expansion for price failed', e);
      piExpansionTried = true;
    }
  }

  // Log level resolution attempts for production debugging
  logger.info('Level resolution attempts', {
    fromSession: !!(sess?.line_items?.data?.[0]?.price?.id),
    fromCheckoutSessionDoc: !!cs?.priceId,
    fromPIExpansionTried: piExpansionTried,
    finalPriceId: priceId
  });

  let level: any = undefined;
  if (priceId) {
    try {
      level = await resolveLevelByPriceId(priceId);
    } catch (e) {
      logger.error('❌ resolveLevelByPriceId failed', { priceId, err: e });
    }
  }
  
  // Don't try to backfill a ONE_TIME level without a price
  if (!level?._id) {
    logger.warn('⚠️ Unable to resolve level for PI; returning 200 (no activation).', { 
      pi: pi.id, 
      priceId, 
      sessId: sess?.id,
      levelResolutionFailed: true
    });
    return;
  }

  let markedReady = false;

  try {
    // Get user details for billing name
    const userId = cs?.userId || pi.metadata?.userId;
    if (!userId) {
      logger.warn('⚠️ No userId found for PI activation', { pi: pi.id });
      return;
    }

    const user = await User.findById(userId).select('name email').lean();
    const billingName = user?.name?.first && user?.name?.last 
      ? `${user.name.first} ${user.name.last}`
      : 'Customer';

    // Upsert ONE_TIME subscription - ensure only one per user
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
    // IMPORTANT: do NOT set gatewayInvoiceId here if you don't have one
    const orderResult = await Order.updateOne(
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
          // gatewayInvoiceId is intentionally omitted - only set when you have an actual invoice id
        },
      },
      { upsert: true, runValidators: true }
    );

    // Promote user to ACTIVE (idempotent) and unset signupIntent
    const justActivated = await User.updateOne(
      { _id: userId, status: { $ne: 'ACTIVE' } },
      { 
        $set: { status: 'ACTIVE' },
        $unset: { signupIntent: 1 }
      }
    );
    
    if (justActivated.modifiedCount > 0) {
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
    }

    // Fast cache on user (webhook is the only writer)
    const levelDoc = await MembershipLevel.findById(level._id);
    if (levelDoc?.key) {
      // Only update if the membership level has actually changed
      await User.updateOne(
        { _id: userId, membershipLevel: { $ne: levelDoc.key } }, 
        { $set: { membershipLevel: levelDoc.key } }
      );
    }

    // Handle subscription switching: if user had a recurring subscription, cancel it
    const existingRecurringSub = await Subscription.findOne({ 
      userId: userId, 
      kind: 'RECURRING', 
      status: 'ACTIVE' 
    });
    
    if (existingRecurringSub && existingRecurringSub.stripeSubscriptionId) {
      try {
        // Cancel the subscription in Stripe (immediate cancellation)
        await stripe.subscriptions.update(existingRecurringSub.stripeSubscriptionId, {
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
      } catch (cancelError) {
        logger.error('❌ Failed to cancel recurring subscription for lifetime switch:', cancelError);
        // Don't fail the webhook for this; the lifetime membership is still valid
      }
    }

    logger.info(`ONE_TIME payment activated successfully for PI: ${pi.id}`);
  } catch (error) {
    logger.error(`❌ ONE_TIME activation block failed for PI: ${pi.id}`, error);
    // IMPORTANT: don't rethrow after a settled charge
  } finally {
    try {
      // Prefer exact doc if you have it
      if (cs?._id) {
        await CheckoutSession.updateOne({ _id: cs._id }, { $set: { ready: true, readyAt: new Date() } });
      } else if (sess?.id) {
        await CheckoutSession.updateOne({ stripeSessionId: sess.id }, { $set: { ready: true, readyAt: new Date() } });
      }
      markedReady = true;
      logger.info('CheckoutSession marked ready in finally for ONE_TIME', { pi: pi.id, csId: cs?._id, sessId: sess?.id });
    } catch (e) {
      logger.error('❌ Failed to mark CheckoutSession ready in finally', e);
    }
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
export async function handlePaymentIntentFailed(event: StripePaymentIntentEvent) {
  const pi = event.data.object;
  logger.info('❌ payment_intent.payment_failed', { 
    id: pi.id, 
    customer: pi.customer,
    lastPaymentError: pi.last_payment_error,
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status
  });

  try {
    // Handle failed payment logic here
    // This could include:
    // - Updating checkout session status
    // - Sending failure notifications
    // - Logging the failure for retry logic
    
    logger.info('✅ payment_intent.payment_failed processed successfully:', { paymentIntentId: pi.id });
  } catch (error) {
    logger.error(`❌ Error processing payment_intent.payment_failed for PI: ${pi.id}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't re-throw - log and continue
  }
}
