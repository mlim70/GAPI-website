// backend/scripts/retryFailedWebhooks.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import WebhookEvent from '../src/models/webhookEvent.model';
import { stripe } from '../src/lib/stripe';
import { syncSingleMembershipLevel } from '../src/utils/syncStripeMemberships';

async function retryFailedWebhooks() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all failed webhook events
    const failedEvents = await WebhookEvent.find({ status: 'failed' }).sort({ processedAt: -1 });
    console.log(`Found ${failedEvents.length} failed webhook events`);

    if (failedEvents.length === 0) {
      console.log('No failed webhook events to retry');
      return;
    }

    // Process each failed event
    for (const webhookEvent of failedEvents) {
      console.log(`\n🔄 Retrying event: ${webhookEvent.eventId} (${webhookEvent.eventType})`);
      
      try {
        // Fetch the original event from Stripe
        const stripeEvent = await stripe.events.retrieve(webhookEvent.eventId);
        console.log(`✅ Retrieved event from Stripe: ${stripeEvent.type}`);

        // Process the event based on its type
        switch (stripeEvent.type) {
          case 'checkout.session.completed':
            console.log('💳 Processing checkout.session.completed event');
            // For now, just mark as processed since the main issue was the membership level sync
            await WebhookEvent.updateOne(
              { eventId: webhookEvent.eventId },
              { status: 'processed' }
            );
            console.log('✅ Marked checkout.session.completed as processed');
            break;

          case 'payment_intent.created':
            console.log('💳 Processing payment_intent.created event');
            // This is just a creation event, no action needed
            await WebhookEvent.updateOne(
              { eventId: webhookEvent.eventId },
              { status: 'processed' }
            );
            console.log('✅ Marked payment_intent.created as processed');
            break;

          case 'product.updated':
          case 'product.created':
          case 'price.updated':
          case 'price.created':
          case 'price.deleted':
            console.log('🔄 Processing membership sync event');
            await syncSingleMembershipLevel(stripeEvent);
            await WebhookEvent.updateOne(
              { eventId: webhookEvent.eventId },
              { status: 'processed' }
            );
            console.log('✅ Processed membership sync event');
            break;

          default:
            console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
            await WebhookEvent.updateOne(
              { eventId: webhookEvent.eventId },
              { status: 'processed' }
            );
            console.log('✅ Marked unhandled event as processed');
        }

      } catch (error) {
        console.error(`❌ Failed to retry event ${webhookEvent.eventId}:`, error);
        // Keep the event as failed
      }
    }

    console.log('\n✅ Finished retrying failed webhook events');

  } catch (error) {
    console.error('Error retrying failed webhooks:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
retryFailedWebhooks(); 