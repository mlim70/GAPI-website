// backend/scripts/clearAllPendingUsers.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';

async function clearAllPendingUsers() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('🔍 Looking for all PendingUser records...');

    // Find all PendingUser records
    const allPendingUsers = await PendingUser.find({});
    console.log(`Found ${allPendingUsers.length} PendingUser records`);

    if (allPendingUsers.length === 0) {
      console.log('No PendingUser records found');
      return;
    }

    // Show what we're about to delete
    console.log('\n📋 PendingUser records to be deleted:');
    allPendingUsers.forEach((pendingUser, index) => {
      console.log(`${index + 1}. ${pendingUser.email} (${pendingUser.username}) - Expires: ${pendingUser.expiresAt.toISOString()}`);
    });

    console.log('\n⚠️  WARNING: This will delete ALL pending users and their related checkout sessions!');
    console.log('This action cannot be undone.');
    
    // In a real scenario, you might want to add a confirmation prompt here
    // For now, we'll proceed with the deletion

    let totalDeletedCheckoutSessions = 0;
    let totalDeletedPendingUsers = 0;

    for (const pendingUser of allPendingUsers) {
      console.log(`🗑️ Deleting PendingUser: ${pendingUser.email} (${pendingUser.username})`);
      
      // Delete related CheckoutSession records first
      const deletedCheckoutSessions = await CheckoutSession.deleteMany({ 
        pendingUserId: pendingUser._id 
      });
      
      console.log(`  - Deleted ${deletedCheckoutSessions.deletedCount} related CheckoutSession records`);
      totalDeletedCheckoutSessions += deletedCheckoutSessions.deletedCount;
      
      // Delete the pending user
      await PendingUser.findByIdAndDelete(pendingUser._id);
      totalDeletedPendingUsers++;
      
      console.log(`  - Deleted PendingUser record`);
    }

    console.log('\n🎉 Cleanup complete!');
    console.log(`Total deleted PendingUser records: ${totalDeletedPendingUsers}`);
    console.log(`Total deleted CheckoutSession records: ${totalDeletedCheckoutSessions}`);

  } catch (error) {
    console.error('Error clearing PendingUser records:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
clearAllPendingUsers(); 