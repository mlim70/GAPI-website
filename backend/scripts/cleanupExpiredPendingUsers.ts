// backend/scripts/cleanupExpiredPendingUsers.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import { deleteFromS3, getS3KeyFromUrl } from '../src/utils/s3Upload';

async function cleanupExpiredPendingUsers() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const now = new Date();
    console.log(`🔍 Looking for expired PendingUser records (before ${now.toISOString()})...`);

    // Find all expired PendingUser records
    const expiredPendingUsers = await PendingUser.find({
      expiresAt: { $lt: now }
    });

    console.log(`Found ${expiredPendingUsers.length} expired PendingUser records`);

    if (expiredPendingUsers.length === 0) {
      console.log('No expired PendingUser records found');
      return;
    }

    let totalDeletedCheckoutSessions = 0;
    let totalDeletedPendingUsers = 0;

    for (const pendingUser of expiredPendingUsers) {
      console.log(`🗑️ Cleaning up expired PendingUser: ${pendingUser._id} (expired at ${pendingUser.expiresAt.toISOString()})`);
      
      // Delete related CheckoutSession records first
      const deletedCheckoutSessions = await CheckoutSession.deleteMany({ 
        pendingUserId: pendingUser._id 
      });
      
      console.log(`  - Deleted ${deletedCheckoutSessions.deletedCount} related CheckoutSession records`);
      totalDeletedCheckoutSessions += deletedCheckoutSessions.deletedCount;
      
      // Delete profile picture from S3 if it exists
      if (pendingUser.avatarUrl) {
        const avatarKey = getS3KeyFromUrl(pendingUser.avatarUrl);
        if (avatarKey) {
          try {
            await deleteFromS3(avatarKey);
            console.log(`  - Deleted profile picture from S3: ${avatarKey}`);
          } catch (deleteError) {
            console.warn(`  - Failed to delete profile picture from S3: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
          }
        }
      }
      
      // Delete the expired pending user
      await PendingUser.findByIdAndDelete(pendingUser._id);
      totalDeletedPendingUsers++;
      
      console.log(`  - Deleted PendingUser record`);
    }

    console.log('\n🎉 Cleanup complete!');
    console.log(`Total deleted PendingUser records: ${totalDeletedPendingUsers}`);
    console.log(`Total deleted CheckoutSession records: ${totalDeletedCheckoutSessions}`);

  } catch (error) {
    console.error('Error cleaning up expired PendingUser records:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupExpiredPendingUsers();
}

export default cleanupExpiredPendingUsers; 