// backend/src/lib/stripe/webhooks/handlers/subscription.ts
import { stripe } from '../../client';
import User from '../../../../models/user.model';
import CheckoutSession from '../../../../models/checkoutSession.model';
import Subscription from '../../../../models/subscription.model';

import { upsertDbSubscriptionFromStripeSub, resolveLevelByPriceId } from '../utils/subscription';
import { logger } from '../../../../utils/general/logger';
import { StripeSubscriptionEvent } from '../types';
import { recomputeUserMembershipLevel } from '../../../../services/subscriptions';
import { safeActivateUser } from '../../../../utils/accounts/duplicateEmailHandler';

/**
 * IMPORTANT: We do NOT mark CheckoutSessions as ready here unless we can confirm
 * that the first invoice payment has succeeded. This prevents race conditions
 * where subscription.created fires before invoice payment processing.
 * 
 * CheckoutSessions are marked ready by:
 * - invoice.payment_succeeded (for recurring subscriptions)
 * - payment_intent.succeeded (for one-time payments)
 * - checkout.session.completed (only for immediate payment confirmations)
 */
export async function handleSubscriptionCreated(event: StripeSubscriptionEvent) {
  const sub = event.data.object;
  logger.info('📅 customer.subscription.created', { 
    id: sub.id, 
    customer: sub.customer,
    status: sub.status
  });

  const doc = await upsertDbSubscriptionFromStripeSub(sub);
  if (doc?.userId) {
    const priceId = sub.items?.data?.[0]?.price?.id || null;
    
    // Update user membership level cache via recomputeUserMembershipLevel
    await recomputeUserMembershipLevel(doc.userId);
    
    // ✅ LINK CHECKOUTSESSION TO SUBSCRIPTION: Find and link the CheckoutSession that created this subscription
    // This is critical for marking the checkout session as ready
    try {
      // Add disambiguation when backfilling: prefer priceId match and most recent session
      const checkoutSession = await CheckoutSession.findOne({
        userId: doc.userId,
        mode: 'subscription',
        stripeSubscriptionId: { $exists: false },
        ...(priceId ? { priceId } : {}),
      }).sort({ createdAt: -1 });
      
      if (checkoutSession) {
        // Link the CheckoutSession to the subscription
        await CheckoutSession.updateOneWithValidation(
          { _id: checkoutSession._id },
          { $set: { stripeSubscriptionId: sub.id } }
        );
        logger.info('Linked CheckoutSession to subscription:', {
          checkoutSessionId: checkoutSession._id,
          stripeSubscriptionId: sub.id
        });
      }
    } catch (linkError) {
      logger.warn('⚠️ Failed to link CheckoutSession to subscription:', linkError);
      // Don't fail the webhook for this linking step
    }
    
    // CHECKOUTSESSION READY BACKSTOP: Only mark ready if we have confirmed payment success
    // This prevents race conditions where subscription.created fires before invoice payment
    if (['active', 'trialing', 'past_due'].includes(sub.status)) {
      try {
        // Check if the latest invoice has a successful payment intent
        const latestInvoice = sub.latest_invoice;
        if (latestInvoice) {
          const invoiceId = typeof latestInvoice === 'string' ? latestInvoice : latestInvoice.id;
          if (invoiceId) {
            // Fetch the invoice to check payment status
            const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] });
            const paymentIntent = invoice.payment_intent;
            
            if (paymentIntent && typeof paymentIntent === 'object' && paymentIntent.status === 'succeeded') {
              // Payment confirmed - safe to mark ready and complete
              const updateResult = await CheckoutSession.updateMany(
                { stripeSubscriptionId: sub.id, ready: { $ne: true } },
                { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
              );
              if (updateResult.modifiedCount > 0) {
                logger.info('CheckoutSession ready backstop: Marked ready via subscription.created (confirmed payment):', {
                  stripeSubscriptionId: sub.id,
                  invoiceId: invoice.id,
                  paymentIntentId: paymentIntent.id,
                  modifiedCount: updateResult.modifiedCount
                });
              }
            } else {
              logger.debug('CheckoutSession ready backstop: Skipped - payment not yet confirmed:', {
                stripeSubscriptionId: sub.id,
                invoiceId: invoice.id,
                paymentIntentStatus: paymentIntent ? (typeof paymentIntent === 'string' ? 'string_id' : paymentIntent.status) : 'none'
              });
            }
          }
        } else {
          logger.debug('CheckoutSession ready backstop: Skipped - no latest invoice found:', {
            stripeSubscriptionId: sub.id
          });
        }
      } catch (e: any) {
        logger.warn('⚠️ CheckoutSession ready backstop failed in subscription.created:', e?.message || e);
        // Don't fail the webhook for this backstop
      }
    }
  }
  
  logger.info('✅ customer.subscription.created processed successfully:', { subscriptionId: sub.id });
}

/**
 * Handle customer.subscription.updated event
 * 
 * IMPORTANT: We do NOT mark CheckoutSessions as ready here unless we can confirm
 * that the latest invoice payment has succeeded. This prevents race conditions
 * where subscription.updated fires before invoice payment processing.
 * 
 * CheckoutSessions are marked ready by:
 * - invoice.payment_succeeded (for recurring subscriptions)
 * - payment_intent.succeeded (for one-time payments)
 * - checkout.session.completed (only for immediate payment confirmations)
 */
export async function handleSubscriptionUpdated(event: StripeSubscriptionEvent) {
  const sub = event.data.object;
  logger.info('📅 customer.subscription.updated', { 
    id: sub.id, 
    customer: sub.customer,
    status: sub.status
  });

  const doc = await upsertDbSubscriptionFromStripeSub(sub);
  if (doc?.userId) {
    if (['active', 'trialing', 'past_due'].includes(sub.status)) {
      // Keep membership during dunning (past_due) to maintain access, but not on unpaid
      const priceId = sub.items?.data?.[0]?.price?.id || null;
      const level = priceId ? await resolveLevelByPriceId(priceId) : null;
      // Update user membership level cache via recomputeUserMembershipLevel
      await recomputeUserMembershipLevel(doc.userId);
      
      // Ensure recurring subscriptions have proper autoRenews and nextBillDate
      if (doc.kind === 'RECURRING') {
        const updateData: any = {};
        
        // Set nextBillDate if not already set or if it's different
        if (sub.current_period_end) {
          const newNextBillDate = new Date(sub.current_period_end * 1000);
          if (!doc.nextBillDate || doc.nextBillDate.getTime() !== newNextBillDate.getTime()) {
            updateData.nextBillDate = newNextBillDate;
          }
        }
        
        // Ensure autoRenews is properly set for recurring subscriptions
        if (doc.autoRenews === false && !sub.cancel_at_period_end) {
          updateData.autoRenews = true;
        }
        
                  // Update if we have changes
          if (Object.keys(updateData).length > 0) {
            await Subscription.updateOne(
              { _id: doc._id },
              { $set: updateData },
              { runValidators: true }
            );
            logger.debug('Updated recurring subscription fields via subscription.updated:', updateData);
          }
      }
      
      // LINK CHECKOUTSESSION TO SUBSCRIPTION: Ensure CheckoutSession is linked (fallback)
      // This handles cases where the subscription.created webhook might have failed to link
      try {
        // Add disambiguation when backfilling: prefer priceId match and most recent session
        const checkoutSession = await CheckoutSession.findOne({
          userId: doc.userId,
          mode: 'subscription',
          stripeSubscriptionId: { $exists: false },
          ...(priceId ? { priceId } : {}),
        }).sort({ createdAt: -1 });
        
        if (checkoutSession) {
          await CheckoutSession.updateOneWithValidation(
            { _id: checkoutSession._id },
            { $set: { stripeSubscriptionId: sub.id } }
          );
          logger.debug('Linked CheckoutSession to subscription via subscription.updated:', {
            checkoutSessionId: checkoutSession._id,
            stripeSubscriptionId: sub.id
          });
        }
      } catch (linkError) {
        logger.warn('⚠️ Failed to link CheckoutSession to subscription in subscription.updated:', linkError);
      }
      
      // PROMOTION BACKSTOP: Ensure user is ACTIVE on active/trialing/past_due status
      // This is a safety net if the first invoice webhook is delayed or fails
      // It ensures users get access even if there are webhook processing issues
      const activationResult = await safeActivateUser(doc.userId.toString());
      const justActivated = { modifiedCount: activationResult.modifiedCount };
      
      if (justActivated.modifiedCount > 0) {
        logger.info('Promotion backstop: User activated to ACTIVE via subscription.updated:', doc.userId);
      } else {
        logger.debug('User already ACTIVE, no status change needed (subscription.updated)');
      }
      
      // CHECKOUTSESSION READY BACKSTOP: Only mark ready if we have confirmed payment success
      // This prevents race conditions where subscription.updated fires before invoice payment
      try {
        // Check if the latest invoice has a successful payment intent
        const latestInvoice = sub.latest_invoice;
        if (latestInvoice) {
          const invoiceId = typeof latestInvoice === 'string' ? latestInvoice : latestInvoice.id;
          if (invoiceId) {
            // Fetch the invoice to check payment status
            const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] });
            const paymentIntent = invoice.payment_intent;
            
            if (paymentIntent && typeof paymentIntent === 'object' && paymentIntent.status === 'succeeded') {
              // Payment confirmed - safe to mark ready
              const updateResult = await CheckoutSession.updateMany(
                { stripeSubscriptionId: sub.id, ready: { $ne: true } },
                { $set: { ready: true, readyAt: new Date(), status: 'COMPLETED' } }
              );
              if (updateResult.modifiedCount > 0) {
                logger.info('CheckoutSession ready backstop: Marked ready via subscription.updated (confirmed payment):', {
                  stripeSubscriptionId: sub.id,
                  invoiceId: invoice.id,
                  paymentIntentId: paymentIntent.id,
                  modifiedCount: updateResult.modifiedCount
                });
              }
            } else {
              logger.debug('CheckoutSession ready backstop: Skipped - payment not yet confirmed:', {
                stripeSubscriptionId: sub.id,
                invoiceId: invoice.id,
                paymentIntentStatus: paymentIntent ? (typeof paymentIntent === 'string' ? 'string_id' : paymentIntent.status) : 'none'
              });
            }
          }
        } else {
          logger.debug('CheckoutSession ready backstop: Skipped - no latest invoice found:', {
            stripeSubscriptionId: sub.id
          });
        }
        } catch (e: any) {
            logger.warn('⚠️ CheckoutSession ready backstop failed:', e?.message || e);
            // Don't fail the webhook for this backstop
        }
      
        } else if (['canceled', 'paused', 'incomplete', 'incomplete_expired'].includes(sub.status)) {
            // Recompute membership level instead of blindly clearing it
            // This ensures users don't lose access if they have other active subscriptions
            await recomputeUserMembershipLevel(doc.userId);
        }
    }
  
  logger.info('✅ customer.subscription.updated processed successfully:', { subscriptionId: sub.id });
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(event: StripeSubscriptionEvent) {
  const deletedSub = event.data.object;
  logger.info('📅 customer.subscription.deleted', { 
    id: deletedSub.id, 
    customer: deletedSub.customer,
    status: deletedSub.status
  });

  // 1) Update subscription status with precise timing
  const updateResult = await Subscription.updateOne(
    { stripeSubscriptionId: deletedSub.id },
    { 
      $set: { 
        status: 'CANCELLED', 
        endDate: deletedSub.ended_at ? new Date(deletedSub.ended_at * 1000) : new Date(),
        cancelDate: new Date(),
        cancelReason: deletedSub.cancellation_details?.reason || 'webhook_deleted'
      } 
    },
    { runValidators: true }
  );

  if (updateResult.matchedCount === 0) {
    logger.warn('⚠️ No local subscription found for deleted Stripe sub:', deletedSub.id);
    return;
  }

  logger.info('Subscription status updated to CANCELLED:', updateResult);

  // 2) Get the affected user and subscription details
  const custId = typeof deletedSub.customer === 'string' ? deletedSub.customer : deletedSub.customer?.id;
  const user = custId ? await User.findOne({ stripeCustomerId: custId }).select('_id membershipLevel status') : null;
  
  if (!user) {
    logger.warn('⚠️ No user found for deleted subscription customer:', custId);
    return;
  }

  // 3) Recompute user's membership level based on remaining active subscriptions
  const finalMembershipLevel = await recomputeUserMembershipLevel(user._id);

  // 4) Log final subscription status
  const activeSubscriptions = await Subscription.countDocuments({
    userId: user._id,
    status: 'ACTIVE'
  });

  logger.info('User subscription status after cancellation:', {
    userId: user._id,
    activeCount: activeSubscriptions,
    membershipLevel: finalMembershipLevel || 'none'
  });
  
  logger.info('✅ customer.subscription.deleted processed successfully:', { stripeSubscriptionId: deletedSub.id });
}
