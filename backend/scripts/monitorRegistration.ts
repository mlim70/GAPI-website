// backend/scripts/monitorRegistration.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';

async function monitorRegistration() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('🔍 MONITORING REGISTRATION PROCESS');
    console.log('=====================================');
    console.log('This script will monitor database changes during frontend registration.');
    console.log('Please start a registration in your frontend now...\n');

    // Initial state
    let initialUsers = await User.find({});
    let initialPendingUsers = await PendingUser.find({});
    let initialCheckoutSessions = await CheckoutSession.find({});

    console.log('📊 INITIAL DATABASE STATE:');
    console.log(`   Users: ${initialUsers.length}`);
    console.log(`   PendingUsers: ${initialPendingUsers.length}`);
    console.log(`   CheckoutSessions: ${initialCheckoutSessions.length}\n`);

    console.log('⏳ Monitoring for changes... (Press Ctrl+C to stop)\n');

    // Monitor for changes every 2 seconds
    const interval = setInterval(async () => {
      try {
        const currentUsers = await User.find({});
        const currentPendingUsers = await PendingUser.find({});
        const currentCheckoutSessions = await CheckoutSession.find({});

        // Check for changes
        const userChanged = currentUsers.length !== initialUsers.length;
        const pendingUserChanged = currentPendingUsers.length !== initialPendingUsers.length;
        const checkoutSessionChanged = currentCheckoutSessions.length !== initialCheckoutSessions.length;

        if (userChanged || pendingUserChanged || checkoutSessionChanged) {
          console.log(`🔄 DATABASE CHANGE DETECTED at ${new Date().toLocaleTimeString()}:`);
          console.log(`   Users: ${initialUsers.length} → ${currentUsers.length}`);
          console.log(`   PendingUsers: ${initialPendingUsers.length} → ${currentPendingUsers.length}`);
          console.log(`   CheckoutSessions: ${initialCheckoutSessions.length} → ${currentCheckoutSessions.length}`);

          // Show details of new records
          if (currentPendingUsers.length > initialPendingUsers.length) {
            const newPendingUsers = currentPendingUsers.filter(pending => 
              !initialPendingUsers.some(initial => initial._id.equals(pending._id))
            );
            console.log('\n📝 NEW PENDING USERS:');
            newPendingUsers.forEach(pending => {
              console.log(`   - ${pending.email} (${pending.username}) - Expires: ${pending.expiresAt.toISOString()}`);
            });
          }

          if (currentCheckoutSessions.length > initialCheckoutSessions.length) {
            const newCheckoutSessions = currentCheckoutSessions.filter(session => 
              !initialCheckoutSessions.some(initial => initial._id.equals(session._id))
            );
            console.log('\n💳 NEW CHECKOUT SESSIONS:');
            newCheckoutSessions.forEach(session => {
              console.log(`   - Session ID: ${session.stripeSessionId} - PendingUser: ${session.pendingUserId}`);
            });
          }

          if (currentUsers.length > initialUsers.length) {
            const newUsers = currentUsers.filter(user => 
              !initialUsers.some(initial => initial._id.equals(user._id))
            );
            console.log('\n✅ NEW USERS CREATED:');
            newUsers.forEach(user => {
              console.log(`   - ${user.email} (${user.username}) - Level: ${user.membershipLevel}`);
            });
          }

          // Update initial state
          initialUsers = currentUsers;
          initialPendingUsers = currentPendingUsers;
          initialCheckoutSessions = currentCheckoutSessions;

          console.log('\n⏳ Continuing to monitor...\n');
        }
      } catch (error) {
        console.error('Error monitoring database:', error);
      }
    }, 2000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n\n📊 FINAL DATABASE STATE:');
      console.log(`   Users: ${initialUsers.length}`);
      console.log(`   PendingUsers: ${initialPendingUsers.length}`);
      console.log(`   CheckoutSessions: ${initialCheckoutSessions.length}`);
      console.log('\nMonitoring stopped.');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error monitoring registration:', error);
  }
}

// Run the monitoring
monitorRegistration(); 