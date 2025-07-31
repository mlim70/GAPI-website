// backend/scripts/cleanupTestData.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import { deleteFromS3, getS3KeyFromUrl } from '../src/utils/s3Upload';

async function cleanupTestData() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('🧹 CLEANING UP TEST DATA\n');

    // Find and delete test users
    const testUsers = await User.find({
      email: { $in: ['test1@gmail.com', 'test2@gmail.com', 'test3@gmail.com', 'test4tag@gmail.com'] }
    });
    
    console.log(`Found ${testUsers.length} test users to delete`);
    
    for (const user of testUsers) {
      console.log(`🗑️ Deleting test user: ${user.email} (${user.username})`);
      
      // Delete profile picture from S3 if it exists
      if (user.avatarUrl) {
        const avatarKey = getS3KeyFromUrl(user.avatarUrl);
        if (avatarKey) {
          try {
            await deleteFromS3(avatarKey);
            console.log(`  - Deleted profile picture from S3: ${avatarKey}`);
          } catch (deleteError) {
            console.warn(`  - Failed to delete profile picture from S3: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
          }
        }
      }
      
      await User.findByIdAndDelete(user._id);
    }

    // Find and delete any remaining pending users
    const pendingUsers = await PendingUser.find({});
    console.log(`Found ${pendingUsers.length} pending users to delete`);
    
    for (const pending of pendingUsers) {
      console.log(`🗑️ Deleting pending user: ${pending.email} (${pending.username})`);
      
      // Delete profile picture from S3 if it exists
      if (pending.avatarUrl) {
        const avatarKey = getS3KeyFromUrl(pending.avatarUrl);
        if (avatarKey) {
          try {
            await deleteFromS3(avatarKey);
            console.log(`  - Deleted profile picture from S3: ${avatarKey}`);
          } catch (deleteError) {
            console.warn(`  - Failed to delete profile picture from S3: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
          }
        }
      }
      
      await PendingUser.findByIdAndDelete(pending._id);
    }

    // Find and delete any remaining checkout sessions
    const checkoutSessions = await CheckoutSession.find({});
    console.log(`Found ${checkoutSessions.length} checkout sessions to delete`);
    
    for (const session of checkoutSessions) {
      console.log(`🗑️ Deleting checkout session: ${session._id}`);
      await CheckoutSession.findByIdAndDelete(session._id);
    }

    // Final verification
    console.log('\n📊 FINAL VERIFICATION:');
    const finalUsers = await User.find({});
    const finalPendingUsers = await PendingUser.find({});
    const finalCheckoutSessions = await CheckoutSession.find({});

    console.log(`✅ Total Users: ${finalUsers.length}`);
    console.log(`✅ Total PendingUsers: ${finalPendingUsers.length}`);
    console.log(`✅ Total CheckoutSessions: ${finalCheckoutSessions.length}`);

    if (finalUsers.length === 0 && finalPendingUsers.length === 0 && finalCheckoutSessions.length === 0) {
      console.log('\n🎉 Database is clean and ready for real registrations!');
    } else {
      console.log('\n⚠️ Some data remains in the database');
    }

  } catch (error) {
    console.error('Error cleaning up test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupTestData(); 