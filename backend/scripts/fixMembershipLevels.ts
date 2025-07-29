// backend/scripts/fixMembershipLevels.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { syncMembershipLevels } from '../src/utils/syncStripeMemberships';
import { connectToDatabase } from '../src/utils/db';

export async function fixMembershipLevels() {
  console.log('🔧 Starting membership level fix process...');
  
  // Check for required environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  console.log('✅ Environment variables loaded successfully');
  
  try {
    // Connect to MongoDB
    console.log('\n🔗 Connecting to MongoDB...');
    await connectToDatabase();
    console.log('✅ Connected to MongoDB');
    
    // Sync membership levels from Stripe to database
    console.log('\n🔄 Syncing membership levels from Stripe...');
    await syncMembershipLevels();
    
    console.log('\n✅ Membership level sync completed successfully!');
    console.log('🎉 Your membership levels should now be in sync with Stripe.');
    
  } catch (error) {
    console.error('❌ Failed to fix membership levels:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run if called directly
if (require.main === module) {
  fixMembershipLevels()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
} 