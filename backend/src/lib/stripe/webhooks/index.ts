// backend/src/lib/stripe/webhooks/index.ts
import express, { Request, Response, Router } from 'express';
import { stripe } from '../client';
import { connectToDatabase } from '../../../utils/database/db';
import { STRIPE_WEBHOOK_SECRET } from '../../../config/env';
import WebhookEvent from '../../../models/webhookEvent.model';
import { logger } from '../../../utils/general/logger';
import Stripe from 'stripe';

// Import handlers
import { handleCheckoutSessionCompleted } from './handlers/checkoutSession';
import { handleInvoicePaymentSucceeded, handleInvoicePaymentFailed } from './handlers/invoice';
import { handlePaymentIntentSucceeded, handlePaymentIntentFailed } from './handlers/paymentIntent';
import { handleSubscriptionCreated, handleSubscriptionUpdated, handleSubscriptionDeleted } from './handlers/subscription';
import { handleCustomerCreated, handleCustomerUpdated, handleCustomerDeleted } from './handlers/customer';
import { handleChargeRefunded, handleChargeDisputeClosed } from './handlers/charge';
import { handlePriceUpdated, handlePriceDeleted } from './handlers/price';
import { handleProductUpdated, handleProductDeleted } from './handlers/product';

const router = Router();

// Helper function to check for duplicate key errors
function isDuplicateKeyError(err: any): boolean {
  return err?.code === 11000;
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
    
    // Add the logging code you requested
    const ct = req.headers['content-type'];
    const isBuf = Buffer.isBuffer(req.body);
    logger.info('stripe.webhook.pre-construct', { ct, isBuf, len: isBuf ? (req.body as Buffer).length : (req.body ? JSON.stringify(req.body).length : 0) });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, process.env.STRIPE_WEBHOOK_SECRET!);
      logger.info('stripe.webhook.parsed', { id: event.id, type: event.type });
    } catch (err: any) {
      logger.error('stripe.webhook.signature-failed', { msg: err.message, ct, isBuf });
      // Use 400 here so Stripe doesn't hammer retries for an unrecoverable signature error
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info('Webhook received at:', new Date().toISOString());
    logger.info('Buffer check:', { 
      isBuffer: Buffer.isBuffer(req.body), 
      length: Buffer.isBuffer(req.body) ? req.body.length : 'n/a' 
    });

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
          $setOnInsert: { eventId: event.id, eventType: event.type },
          $set: { claimed: true, claimedAt: new Date(), status: 'processing', errorMessage: undefined },
        },
        { upsert: true, new: true }
      );
    } catch (err: any) {
      if (isDuplicateKeyError(err)) {
        logger.warn('idempotent.duplicate-key-treated-as-success', { eventId: event.id });
        return res.status(200).end();
      }
      logger.error('stripe.webhook.handler-failed', { err: err.message, type: event.type });
      return res.status(500).end(); // only for errors that a retry could actually fix
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

      // Route to appropriate handler based on event type
      switch (event.type) {
        case 'checkout.session.completed':
          logger.info('🔄 Routing to checkout.session.completed handler');
          await handleCheckoutSessionCompleted(event);
          logger.info('✅ checkout.session.completed handler completed');
          break;

        case 'invoice.payment_succeeded':
          logger.info('🔄 Routing to invoice.payment_succeeded handler');
          await handleInvoicePaymentSucceeded(event);
          logger.info('✅ invoice.payment_succeeded handler completed');
          break;

        case 'invoice.payment_failed':
          logger.info('🔄 Routing to invoice.payment_failed handler');
          await handleInvoicePaymentFailed(event);
          logger.info('✅ invoice.payment_failed handler completed');
          break;

        case 'payment_intent.succeeded':
          logger.info('🔄 Routing to payment_intent.succeeded handler');
          await handlePaymentIntentSucceeded(event);
          logger.info('✅ payment_intent.succeeded handler completed');
          break;

        case 'payment_intent.payment_failed':
          logger.info('🔄 Routing to payment_intent.payment_failed handler');
          await handlePaymentIntentFailed(event);
          logger.info('✅ payment_intent.payment_failed handler completed');
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(event);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event);
          break;

        case 'customer.created':
          await handleCustomerCreated(event);
          break;

        case 'customer.updated':
          await handleCustomerUpdated(event);
          break;

        case 'customer.deleted':
          await handleCustomerDeleted(event);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event);
          break;

        case 'charge.dispute.closed':
          await handleChargeDisputeClosed(event);
          break;

        case 'price.updated':
          await handlePriceUpdated(event);
          break;

        case 'price.deleted':
          await handlePriceDeleted(event);
          break;

        case 'product.updated':
          await handleProductUpdated(event);
          break;

        case 'product.deleted':
          await handleProductDeleted(event);
          break;

        default:
          logger.info('⚠️ Unhandled event type:', event.type);
          break;
      }

      // Mark event as processed
      await WebhookEvent.updateOne(
        { _id: claim._id },
        { $set: { status: 'processed', processedAt: new Date() } }
      );

      logger.info('✅ Event processed successfully:', {
        eventId: event.id,
        eventType: event.type,
        processingTime: `${Date.now() - startTime}ms`
      });

      res.status(200).send('ok');

    } catch (error) {
      logger.error('❌ Event processing failed:', error);
      
      // Mark event as failed
      await WebhookEvent.updateOne(
        { _id: claim._id },
        { 
          $set: { 
            status: 'failed', 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date()
          } 
        }
      );

      res.status(500).send('Event processing failed');
    }
  }
);

export default router;
