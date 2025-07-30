// backend/scripts/checkWebhookStatus.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import WebhookEvent from '../src/models/webhookEvent.model';

async function checkWebhookStatus() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check Users collection
    console.log('\n=== USERS COLLECTION ===');
    const users = await User.find({});
    console.log(`Total users: ${users.length}`);
    if (users.length > 0) {
      users.forEach(user => {
        console.log(`- User: ${user.email} (${user.username}) - ID: ${user._id}`);
      });
    }

    // Check PendingUsers collection
    console.log('\n=== PENDING USERS COLLECTION ===');
    const pendingUsers = await PendingUser.find({});
    console.log(`Total pending users: ${pendingUsers.length}`);
    if (pendingUsers.length > 0) {
      pendingUsers.forEach(pendingUser => {
        console.log(`- Pending: ${pendingUser.email} (${pendingUser.username}) - ID: ${pendingUser._id} - Expires: ${pendingUser.expiresAt}`);
      });
    }

    // Check CheckoutSessions collection
    console.log('\n=== CHECKOUT SESSIONS COLLECTION ===');
    const checkoutSessions = await CheckoutSession.find({});
    console.log(`Total checkout sessions: ${checkoutSessions.length}`);
    if (checkoutSessions.length > 0) {
      checkoutSessions.forEach(session => {
        console.log(`- Session: ${session.stripeSessionId} - Status: ${session.status} - PendingUser: ${session.pendingUserId} - Email: ${session.pendingUserEmail}`);
      });
    }

    // Check WebhookEvents collection
    console.log('\n=== WEBHOOK EVENTS COLLECTION ===');
    const webhookEvents = await WebhookEvent.find({}).sort({ processedAt: -1 }).limit(10);
    console.log(`Recent webhook events: ${webhookEvents.length}`);
    if (webhookEvents.length > 0) {
      webhookEvents.forEach(event => {
        console.log(`- Event: ${event.eventId} - Type: ${event.eventType} - Status: ${event.status} - Processed: ${event.processedAt}`);
      });
    }

    // Check for any failed webhook events
    console.log('\n=== FAILED WEBHOOK EVENTS ===');
    const failedEvents = await WebhookEvent.find({ status: 'failed' }).sort({ processedAt: -1 });
    console.log(`Failed webhook events: ${failedEvents.length}`);
    if (failedEvents.length > 0) {
      failedEvents.forEach(event => {
        console.log(`- Failed Event: ${event.eventId} - Type: ${event.eventType} - Processed: ${event.processedAt}`);
      });
    }

  } catch (error) {
    console.error('Error checking webhook status:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkWebhookStatus(); 