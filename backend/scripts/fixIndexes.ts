// backend/scripts/fixIndexes.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import MembershipLevel from '../src/models/membershipLevel.model';
import Subscription from '../src/models/subscription.model';
import Order from '../src/models/order.model';
import WebhookEvent from '../src/models/webhookEvent.model';

async function fixIndexes() {
  console.log('🔧 Starting index fix process...');
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Fix User collection indexes
    console.log('\n🔧 Fixing User collection indexes...');
    try {
      await User.collection.dropIndex('username_1');
      console.log('✅ Dropped existing username index');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️ Username index not found, skipping drop');
      } else {
        console.log('⚠️ Error dropping username index:', error.message);
      }
    }
    
    // Fix PendingUser collection indexes
    console.log('\n🔧 Fixing PendingUser collection indexes...');
    try {
      await PendingUser.collection.dropIndex('expiresAt_1');
      console.log('✅ Dropped existing expiresAt index');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️ ExpiresAt index not found, skipping drop');
      } else {
        console.log('⚠️ Error dropping expiresAt index:', error.message);
      }
    }
    
    try {
      await PendingUser.collection.dropIndex('username_1');
      console.log('✅ Dropped existing username index');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️ Username index not found, skipping drop');
      } else {
        console.log('⚠️ Error dropping username index:', error.message);
      }
    }
    
    // Recreate indexes properly
    console.log('\n🔧 Recreating indexes...');
    
    // User indexes - use a unique name to avoid conflicts
    try {
      await User.collection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          collation: { locale: 'en', strength: 2 },
          name: 'username_case_insensitive_1'
        }
      );
      console.log('✅ Recreated User username index with collation');
    } catch (error: any) {
      if (error.code === 86) {
        console.log('⚠️ Index conflict detected, trying alternative approach...');
        // Try creating without collation first
        try {
          await User.collection.createIndex(
            { username: 1 }, 
            { 
              unique: true,
              name: 'username_unique_1'
            }
          );
          console.log('✅ Recreated User username index without collation');
        } catch (altError: any) {
          console.log('⚠️ Could not create User username index:', altError.message);
        }
      } else {
        console.log('⚠️ Error creating User username index:', error.message);
      }
    }
    
    // PendingUser indexes - use a unique name to avoid conflicts
    try {
      await PendingUser.collection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          collation: { locale: 'en', strength: 2 },
          name: 'username_case_insensitive_1'
        }
      );
      console.log('✅ Recreated PendingUser username index with collation');
    } catch (error: any) {
      if (error.code === 86) {
        console.log('⚠️ Index conflict detected, trying alternative approach...');
        // Try creating without collation first
        try {
          await PendingUser.collection.createIndex(
            { username: 1 }, 
            { 
              unique: true,
              name: 'username_unique_1'
            }
          );
          console.log('✅ Recreated PendingUser username index without collation');
        } catch (altError: any) {
          console.log('⚠️ Could not create PendingUser username index:', altError.message);
        }
      } else {
        console.log('⚠️ Error creating PendingUser username index:', error.message);
      }
    }
    
    try {
      await PendingUser.collection.createIndex(
        { expiresAt: 1 }, 
        { 
          expireAfterSeconds: 0,
          name: 'expiresAt_ttl_1'
        }
      );
      console.log('✅ Recreated PendingUser TTL index');
    } catch (error: any) {
      if (error.code === 86) {
        console.log('⚠️ TTL index conflict detected, trying alternative approach...');
        try {
          await PendingUser.collection.createIndex(
            { expiresAt: 1 }, 
            { 
              expireAfterSeconds: 0,
              name: 'expiresAt_ttl_alt_1'
            }
          );
          console.log('✅ Recreated PendingUser TTL index with alternative name');
        } catch (altError: any) {
          console.log('⚠️ Could not create TTL index:', altError.message);
        }
      } else {
        console.log('⚠️ Error creating TTL index:', error.message);
      }
    }
    
    // Initialize all models to ensure other indexes are created
    console.log('\n🔧 Initializing all models...');
    await Promise.all([
      User.init(),
      MembershipLevel.init(),
      Subscription.init(),
      Order.init(),
      WebhookEvent.init(),
    ]);
    console.log('✅ All models initialized');
    
    console.log('\n🎉 Index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to fix indexes:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixIndexes()
    .then(() => {
      console.log('✅ Index fix process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Index fix process failed:', error);
      process.exit(1);
    });
}

export { fixIndexes }; 