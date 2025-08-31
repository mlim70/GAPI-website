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
import { recomputeUserMembershipLevel, recomputeUserAccountStatus } from '../../../../services/subscriptions';
import { logger } from '../../../../utils/general/logger';
import { StripePaymentIntentEvent } from '../types';
import { safeActivateUser } from '../../../../utils/accounts/duplicateEmailHandler';
import { generateVerifyNonce } from '../../../../middleware/security';

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
  let cs: any = null;
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
  cs = await CheckoutSession.findOne({ stripeSessionId: sess?.id ?? '__none__' });

  const stripeCustomerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null;

  if (!cs && sess?.id) {
    const userId = pi.metadata?.userId;
    const nonce = generateVerifyNonce?.() || 'webhook-backfill';
    try {
      cs = await CheckoutSession.findOneAndUpdateWithValidation(
        { stripeSessionId: sess.id },
        {
          $setOnInsert: {
            // 🔴 REQUIRED BY SCHEMA
            stripeSessionId: sess.id,
            verifyNonce: nonce,
            userId,
            mode: sess.mode,
            levelKey: pi.metadata?.levelKey ?? null,
            createdAt: new Date(),
          },
          $set: {
            paymentIntentId: pi.id,
            stripeCustomerId,
            priceId: undefined, // resolved later via listLineItems
          },
        },
        { upsert: true, new: true }
      );
    } catch (e: any) {
      logger.warn('⚠️ CS backfill failed (continuing without CS upsert)', {
        message: e?.message,
        name: e?.name,
      });
      // Intentionally don't throw; continue with activation and "ready" marking.
    }
  } else if (!cs && !sess?.id) {
    // No session found → cannot confidently create a ONE_TIME record here.
    logger.info('ℹ️ No Checkout Session found for PI; skipping CS backfill for safety.', { pi: pi.id });
  } else if (cs && !cs.paymentIntentId) {
    try {
      await CheckoutSession.updateOneWithValidation(
        { _id: cs._id },
        {
          $set: {
            paymentIntentId: pi.id,
            ...(stripeCustomerId ? { stripeCustomerId } : {}),
          },
        }
      );
    } catch (e: any) {
      logger.warn('⚠️ Failed to attach PI to existing CS (continuing)', {
        id: cs._id?.toString?.(),
        message: e?.message,
        name: e?.name,
        errors: e?.errors ? Object.keys(e.errors) : undefined,
      });
    }
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
    // --- C) (unchanged) resolve level, upsert Subscription, Order, activate user, etc. ---
    // Get user details for billing name - fall back to multiple sources
    let userId = cs?.userId || pi.metadata?.userId || (sess?.client_reference_id as string | undefined);
    if (!userId) {
      logger.warn('⚠️ No userId from PI metadata or client_reference_id', { pi: pi.id, sessId: sess?.id });
      // You can still mark ready, but fix the doc now so polling passes:
      if (cs?._id && (sess?.client_reference_id || pi.metadata?.userId)) {
        await CheckoutSession.updateOneWithValidation(
          { _id: cs._id },
          { $set: { userId: sess?.client_reference_id || pi.metadata?.userId } }
        );
        // Retry getting userId after the update
        userId = sess?.client_reference_id || pi.metadata?.userId;
      }
      
      if (!userId) {
        logger.warn('⚠️ Still no userId found for PI activation after fallback attempts', { pi: pi.id });
        return;
      }
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

    // Promote user to ACTIVE (idempotent) and unset signupIntent - skip if user is DELETED or REFUNDED
    const u = await User.findById(userId).select('status').lean();
    if (u && u.status !== 'DELETED' && u.status !== 'REFUNDED') {
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
        }
      }
    }

     // Handle subscription switching: if user had a recurring subscription, schedule it to end at period end
     const existingRecurringSub = await Subscription.findOne({ 
       userId: userId, 
       kind: 'RECURRING', 
       status: 'ACTIVE' 
     });
     
     if (existingRecurringSub?.stripeSubscriptionId) {
       try {
         // Schedule the Stripe subscription to end at the current period end
         const updated = await stripe.subscriptions.update(
           existingRecurringSub.stripeSubscriptionId,
           {
             cancel_at_period_end: true,
             metadata: {
               superseded_by: String(subscription._id),
               superseded_at: new Date().toISOString(),
             },
           },
           { idempotencyKey: `sub:cancelAtEnd:${existingRecurringSub.stripeSubscriptionId}` }
         );

         await Subscription.updateOne(
           { _id: existingRecurringSub._id },
           {
             $set: {
               status: 'SUPERSEDED',
               cancelReason: 'Superseded by lifetime membership - will cancel at period end',
               supersededBy: subscription._id,
               supersededAt: new Date(),
               nextBillDate: updated.current_period_end
                 ? new Date(updated.current_period_end * 1000)
                 : null,
               stripeStatus: updated.status, // typically 'active'
             }
           },
           { runValidators: true }
         );
         
         logger.info('Recurring subscription scheduled to cancel at period end and marked as superseded:', {
           recurringSubId: existingRecurringSub._id,
           lifetimeSubId: subscription._id,
           userId,
           stripeSubId: existingRecurringSub.stripeSubscriptionId,
           periodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null
         });
       } catch (e) {
         logger.error('❌ Failed to schedule cancel_at_period_end:', {
           subId: existingRecurringSub.stripeSubscriptionId,
           message: (e as any)?.message
         });
       }
     } else if (existingRecurringSub) {
       // No Stripe subscription ID, just mark as superseded locally
       try {
         await Subscription.updateOne(
           { _id: existingRecurringSub._id },
           {
             $set: {
               status: 'SUPERSEDED',
               supersededBy: subscription._id,
               supersededAt: new Date(),
               cancelReason: 'Superseded by lifetime membership - no Stripe subscription to cancel'
             }
           },
           { runValidators: true }
         );
         
         logger.info('Recurring subscription marked as superseded (no Stripe ID):', {
           recurringSubId: existingRecurringSub._id,
           lifetimeSubId: subscription._id,
           userId
         });
       } catch (error) {
         logger.error('❌ Failed to mark subscription as superseded:', error);
       }
     }

         // Update user membership level cache and account status via recompute functions
     try {
       await recomputeUserMembershipLevel(userId);
       await recomputeUserAccountStatus(userId);
       logger.info('User membership level and account status recomputed after payment intent:', { userId });
     } catch (e) {
       logger.error('❌ Failed to recompute user membership level and account status (post-supersede):', e);
     }

    logger.info(`ONE_TIME payment activated successfully for PI: ${pi.id}`);
  } catch (error) {
    logger.error(`❌ ONE_TIME activation block failed for PI: ${pi.id}`, error);
    // IMPORTANT: don't rethrow after a settled charge
  } finally {
    try {
      let modified = 0;

      // A. If we already know the exact doc, flip it.
      if (cs?._id) {
        const r = await CheckoutSession.updateOneWithValidation(
          { _id: cs._id },
          { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
        );
        modified += r.modifiedCount ?? 0;
      }

      // B. If we have the Checkout Session id from Stripe, flip by that.
      if (!modified && sess?.id) {
        const r = await CheckoutSession.updateOneWithValidation(
          { stripeSessionId: sess.id },
          { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
        );
        modified += r.modifiedCount ?? 0;
      }

      // C. Fallback: recent, same customer, ONE_TIME mode.
      //    Helps when PI→Session list races and we couldn't get `sess`.
      const stripeCustomerId =
        typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null;

      if (!modified && stripeCustomerId) {
        const r = await CheckoutSession.updateOne(
          {
            stripeCustomerId,
            mode: 'payment',                // only affect ONE_TIME flow
            status: { $in: ['CREATED'] },   // session we just created
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            ready: { $ne: true },
          },
          { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
        );
        modified += r.modifiedCount ?? 0;
      }

      // D. Last-ditch: try to find any recent ONE_TIME sessions for this customer.
      //    (Covers rare cases where the PI link is still absent.)
      if (!modified && stripeCustomerId) {
        try {
          // Since we can't filter by payment_status in the API, we'll check our local DB
          // for any recent sessions that might have been created but not yet linked
          const r = await CheckoutSession.updateOne(
            {
              stripeCustomerId,
              mode: 'payment',
              status: 'CREATED',
              createdAt: { $gt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // last 2 hours
              ready: { $ne: true },
            },
            { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
          );
          if ((r.modifiedCount ?? 0) > 0) {
            modified += r.modifiedCount ?? 0;
          }
        } catch (ee) {
          logger.warn('⚠️ Fallback customer session scan failed', ee);
        }
      }

      logger.info('CheckoutSession ready marking (ONE_TIME) result', {
        pi: pi.id,
        modified,
        hadCsDoc: !!cs?._id,
        hadSessId: !!sess?.id,
      });
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
