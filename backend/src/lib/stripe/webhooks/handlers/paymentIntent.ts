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
import { recomputeUserMembershipLevel } from '../../../../services/subscriptions';
import { logger } from '../../../../utils/general/logger';
import { StripePaymentIntentEvent } from '../types';
import { safeActivateUser } from '../../../../utils/accounts/duplicateEmailHandler';

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
    const list = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
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
  let cs: any = await CheckoutSession.findOne({ stripeSessionId: sess?.id ?? '__none__' });

  const stripeCustomerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null;

  if (!cs && sess?.id) {
    const userId = pi.metadata?.userId;
    cs = await CheckoutSession.findOneAndUpdateWithValidation(
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
          priceId: undefined, // Will be resolved later via listLineItems
        },
      },
      { upsert: true, new: true }
    );
  } else if (!cs && !sess?.id) {
    // No session found → cannot confidently create a ONE_TIME record here.
    logger.info('ℹ️ No Checkout Session found for PI; skipping CS backfill for safety.', { pi: pi.id });
  } else if (cs && !cs.paymentIntentId) {
    await CheckoutSession.updateOneWithValidation(
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
  let priceId: string | undefined = cs?.priceId as string | undefined;

  if (!priceId && sess?.id) {
    try {
      const items = await stripe.checkout.sessions.listLineItems(sess.id, {
        limit: 1,
        expand: ['data.price'],
      });
      priceId = (items.data?.[0]?.price?.id as string | undefined) ?? priceId;
    } catch (e) {
      logger.warn('⚠️ sessions.listLineItems failed', e);
    }
  }

  // Last fallback: expand PI → latest_charge.invoice.lines for price
  let piExpansionTried = false;
  if (!priceId) {
    try {
      const piFull = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ['latest_charge.invoice.lines.data.price'],
      });
      const invLines = (piFull.latest_charge as any)?.invoice?.lines?.data;
      priceId = invLines?.[0]?.price?.id || undefined;
      
      if (!invLines) {
        logger.info('ℹ️ Fallback PI expansion: no invoice present (expected for one-time charges)', { pi: pi.id });
      }
      piExpansionTried = true;
    } catch (e) {
      logger.warn('⚠️ Fallback PI expansion for price failed or no invoice present', e);
      piExpansionTried = true;
    }
  }

  // Log level resolution attempts for production debugging
  logger.info('Level resolution attempts', {
    fromCheckoutSessionDoc: !!cs?.priceId,
    fromListLineItems: !!(priceId && !cs?.priceId),
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

  try {
    // Get user details for billing name
    let userId = cs?.userId || pi.metadata?.userId;
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
          autoRenews: false
        }
      },
      { upsert: true, new: true, runValidators: true }
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

    // Log order creation/update for debugging
    if (orderResult.upsertedCount > 0) {
      logger.info('📋 New Order created for ONE_TIME payment:', { 
        orderId: orderResult.upsertedId, 
        pi: pi.id, 
        userId 
      });
    } else if (orderResult.modifiedCount > 0) {
      logger.info('📋 Existing Order updated for ONE_TIME payment:', { 
        pi: pi.id, 
        userId 
      });
    }

    // Promote user to ACTIVE (idempotent) and unset signupIntent
    const activationResult = await safeActivateUser(userId);
    const justActivated = { modifiedCount: activationResult.modifiedCount };
    
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

    // Update user membership level cache via recomputeUserMembershipLevel
    await recomputeUserMembershipLevel(userId);

    // Handle subscription switching: if user had a recurring subscription, cancel it
    const existingRecurringSub = await Subscription.findOne({ 
      userId: userId, 
      kind: 'RECURRING', 
      status: 'ACTIVE' 
    });
    
    if (existingRecurringSub && existingRecurringSub.stripeSubscriptionId) {
      try {
        // Don't cancel in Stripe - let it run its course for billing
        // But mark it as superseded locally to avoid conflicts
        
        await Subscription.updateOne(
          { _id: existingRecurringSub._id },
          {
            $set: {
              status: 'SUPERSEDED', // New status - not ACTIVE
              supersededBy: subscription._id, // Reference to lifetime subscription
              supersededAt: new Date(),
              cancelReason: 'Superseded by lifetime membership - billing continues until period end'
            }
          },
          { runValidators: true }
        );
        
        logger.info('Recurring subscription marked as superseded by lifetime membership:', {
          recurringSubId: existingRecurringSub._id,
          lifetimeSubId: subscription._id,
          userId
        });
      } catch (error) {
        logger.error('❌ Failed to mark subscription as superseded:', error);
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
        await CheckoutSession.updateOneWithValidation({ _id: cs._id }, { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } });
      } else if (sess?.id) {
        await CheckoutSession.updateOneWithValidation({ stripeSessionId: sess.id }, { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } });
      }
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
