import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { connectToDatabase } from '../utils/db';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';

const router = express.Router();

// Health check endpoint for webhook monitoring
router.get('/health', async (req, res) => {
  try {
    // Quick database connectivity check
    await connectToDatabase();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('❌ Webhook health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint to verify webhook route is accessible
router.get('/test', (req, res) => {
  res.json({
    message: 'Webhook route is accessible',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl
  });
});

// Webhook status endpoint for monitoring
router.get('/status', async (req, res) => {
  try {
    await connectToDatabase();
    
    // Get recent webhook events
    const recentEvents = await WebhookEvent.find()
      .sort({ processedAt: -1 })
      .limit(10)
      .select('eventId eventType status processedAt');
    
    res.json({
      timestamp: new Date().toISOString(),
      status: 'operational',
      database: 'connected',
      webhook: {
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        recentEvents: recentEvents.map(event => ({
          id: event.eventId,
          type: event.eventType,
          status: event.status,
          processedAt: event.processedAt
        }))
      },
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('❌ Webhook status check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Webhook status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Webhook handler - apply raw parser only to POST
router.post('/', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  console.log('🔔 Webhook received at:', new Date().toISOString());
  
  // DO NOT read or mutate req.body here. Express.raw at app level must put a Buffer on req.body.
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) {
    console.error('❌ Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,                  // must be Buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!   // use your Dashboard secret in prod
    );
    console.log('✅ Webhook signature verified');
    console.log('📦 Event details:', { id: event.id, type: event.type, created: new Date(event.created * 1000) });
  } catch (err: any) {
    console.error('❌ Signature verify failed:', err?.message);
    return res.status(400).send('Bad signature');
  }

  // ⛔️ If Atlas egress is blocked, this connect will hang. Fix allowlist (see section C).
  try {
    await connectToDatabase();
    console.log('✅ Database connected successfully');
  } catch (e) {
    console.error('❌ DB connect failed:', e);
    // Let Stripe retry
    return res.status(500).send('DB connect failed');
  }

  // Idempotency guard (atomic - no race condition)
  // Using updateOne + upsert instead of findOne + create to avoid race conditions
  // where multiple webhooks with same eventId could both pass the findOne check
  const upsertResult = await WebhookEvent.updateOne(
    { eventId: event.id },
    {
      $setOnInsert: {
        eventId: event.id,
        eventType: event.type,
        status: 'processing',
        processedAt: new Date(),
      }
    },
    { upsert: true }
  );

  if (upsertResult.upsertedCount > 0) {
    console.log('✅ New event record created');
  } else {
    // Event already exists, check if already processed
    const existing = await WebhookEvent.findOne({ eventId: event.id }).lean();
    if (existing?.status === 'processed') {
      console.log('✅ Event already processed, returning success');
      return res.status(200).send('ok');
    }
    console.log('⚠️ Event exists but not processed yet, continuing...');
  }

  try {
    console.log('🔄 Processing event type:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('💳 Processing checkout.session.completed event');
        console.log('📦 Session details:', { 
          id: session.id, 
          payment_status: session.payment_status, 
          status: session.status,
          metadata: session.metadata 
        });

        // ✅ Minimal work to unblock your frontend polling:
        // Update by both keys and set explicit boolean your poller can read
        const { pendingUserId, userId, levelKey } = session.metadata ?? {};
        
        // Build $or filter without undefined values to avoid false positives
        // MongoDB { field: undefined } can match docs where the field is missing
        const or: any[] = [{ stripeSessionId: session.id }];
        if (pendingUserId) or.push({ pendingUserId });

        const updatedDoc = await CheckoutSession.findOneAndUpdate(
          { $or: or },
          {
            $set: {
              stripeSessionId: session.id,
              ...(pendingUserId ? { pendingUserId } : {}),
              status: 'READY',
              ready: true,
              readyAt: new Date(),
              sessionStatus: session.status ?? 'complete',
              paymentStatus: session.payment_status,
              pendingUserEmail:
                session.customer_details?.email || session.metadata?.email || null,
              levelKey: levelKey ?? null,
              userId: userId ?? null,
            }
          },
          { upsert: true, new: true }
        );

        console.log('✅ Checkout session updated/created:', {
          id: updatedDoc._id,
          stripeSessionId: updatedDoc.stripeSessionId,
          pendingUserId: updatedDoc.pendingUserId,
          status: updatedDoc.status,
          ready: updatedDoc.ready,
          readyAt: updatedDoc.readyAt
        });

        // If you *must* create the user/sub/order now, keep it lean and idempotent.
        // For now, just mark as ready and let the frontend polling handle the rest
        break;
      }

      case 'invoice.payment_succeeded':
        console.log('💳 Processing invoice.payment_succeeded event');
        // Keep minimal - just update subscription nextBillDate if needed
        break;

      case 'customer.subscription.deleted':
        console.log('❌ Processing subscription deletion event');
        // Keep minimal - just mark as cancelled
        break;

      case 'customer.subscription.updated':
        console.log('🔄 Processing subscription update event');
        // Keep minimal - just update subscription status
        break;

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    // Update status and set accurate completion time
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { $set: { status: 'processed', processedAt: new Date() } }
    );
    console.log('✅ Webhook event processed successfully:', event.id);

    // ✅ Acknowledge to Stripe
    return res.status(200).send('ok');
  } catch (e) {
    console.error('❌ Processing failed:', e);
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { $set: { status: 'failed', processedAt: new Date() } }
    );
    // Non-2xx makes Stripe retry
    return res.status(500).send('error');
  }
});

export default router;
