import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { connectToDatabase } from '../utils/db';
import CheckoutSession from '../models/checkoutSession.model';
import WebhookEvent from '../models/webhookEvent.model';
import Subscription from '../models/subscription.model';

const router = express.Router();

/**
 * Maps Stripe subscription status to application status
 * Keeps users active for trialing, past_due, unpaid (usually you still want the user active)
 */
function toAppStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'unpaid':
      return 'ACTIVE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELLED';
    default:
      return 'ACTIVE'; // safest default
  }
}

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

  // CLAIM MECHANISM: Only one process handles each event
  // Allow re-claiming if last attempt failed
  console.log('🔒 Attempting to claim webhook event...');
  let claim;
  try {
    claim = await WebhookEvent.findOneAndUpdate(
      { eventId: event.id, $or: [ { claimed: { $ne: true } }, { status: 'failed' } ] },
      {
        $setOnInsert: { eventId: event.id, eventType: event.type, processedAt: new Date() },
        $set: { claimed: true, claimedAt: new Date(), status: 'processing' }
      },
      { upsert: true, new: true }
    );
  } catch (e: any) {
    if (e?.code === 11000) {
      console.log('⚠️ Event already claimed (duplicate key), exiting');
      return res.status(200).send('ok');
    }
    throw e;
  }
  
  if (!claim || claim.status === 'processed') {
    console.log('⚠️ Event already claimed or processed, exiting');
    return res.status(200).send('ok'); // already handled
  }
  
  console.log('✅ Event claimed successfully, processing...');

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

        // ✅ Lightweight session status tracking for observability only
        // No user creation - that's handled by frontend polling + finalization lock
        const { pendingUserId, userId, levelKey } = session.metadata ?? {};
        
        // Build $or filter without undefined values to avoid false positives
        const or: any[] = [{ stripeSessionId: session.id }];
        if (pendingUserId) or.push({ pendingUserId });

        // Minimal update: just track session status for observability
        await CheckoutSession.findOneAndUpdate(
          { $or: or },
          {
            $set: {
              stripeSessionId: session.id,
              ...(pendingUserId ? { pendingUserId } : {}),
              status: 'COMPLETED',           // Stripe finished
              ready: false,                  // not finalized yet
              completedAt: new Date(),
              stripeSessionStatus: session.status,
              stripePaymentStatus: session.payment_status,
              pendingUserEmail:
                session.customer_details?.email || session.metadata?.email || null,
              levelKey: levelKey ?? null,
              expiresAt: new Date(Date.now() + 24*60*60*1000), // 24 hours from now
              userId: null,
            }
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );

        console.log('✅ Checkout session status tracked for observability (no user creation)');
        break;
      }

      case 'invoice.payment_succeeded': {
        console.log('💳 Processing invoice.payment_succeeded event');
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
        
        if (subId) {
          try {
            // Get the subscription to get the authoritative current_period_end
            const s = await stripe.subscriptions.retrieve(subId);
            await Subscription.findOneAndUpdate(
              { gatewaySubId: subId },
              {
                $set: {
                  status: 'ACTIVE',
                  nextBillDate: s.current_period_end ? new Date(s.current_period_end * 1000) : null
                }
              }
            );
            console.log('✅ Updated subscription nextBillDate from subscription period:', subId);
          } catch (e) {
            console.warn('⚠️ Could not update subscription for invoice:', e);
          }
        }
        break;
      }

      case 'customer.subscription.deleted':
        console.log('❌ Processing subscription deletion event');
        const deletedSub = event.data.object as Stripe.Subscription;
        try {
          await Subscription.updateMany(
            { gatewaySubId: deletedSub.id },
            { 
              $set: { 
                status: 'CANCELLED',
                endDate: new Date(),
                cancelDate: new Date()
              } 
            }
          );
          console.log('✅ Marked subscription as cancelled:', deletedSub.id);
        } catch (e) {
          console.warn('⚠️ Could not cancel subscription:', e);
        }
        break;

      case 'customer.subscription.updated':
        console.log('🔄 Processing subscription update event');
        const updatedSub = event.data.object as Stripe.Subscription;
        try {
          await Subscription.updateMany(
            { gatewaySubId: updatedSub.id },
            { 
              $set: { 
                status: toAppStatus(updatedSub.status),
                nextBillDate: updatedSub.current_period_end ? new Date(updatedSub.current_period_end * 1000) : null,
                endDate: updatedSub.cancel_at_period_end ? new Date(updatedSub.current_period_end * 1000) : null
              } 
            }
          );
          console.log('✅ Updated subscription status:', updatedSub.id, 'Stripe status:', updatedSub.status, '→ App status:', toAppStatus(updatedSub.status));
        } catch (e) {
          console.warn('⚠️ Could not update subscription:', e);
        }
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

    // Acknowledge to Stripe
    return res.status(200).send('ok');
  } catch (e) {
    console.error('❌ Processing failed:', e);
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { 
        $set: { status: 'failed', processedAt: new Date(), errorMessage: String(e?.message || e) },
        $unset: { claimed: "", claimedAt: "" } // Let a retry claim it
      }
    );
    // Non-2xx makes Stripe retry
    return res.status(500).send('error');
  }
});

export default router;
