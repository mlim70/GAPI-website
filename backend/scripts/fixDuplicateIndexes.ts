// backend/scripts/fixDuplicateIndexes.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';

async function fixDuplicateIndexes() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Fix User collection indexes
    console.log('\n=== FIXING USER INDEXES ===');
    try {
      // Drop all indexes except _id
      await User.collection.dropIndexes();
      console.log('✅ Dropped all User indexes');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️ No User indexes to drop');
      } else {
        console.log('⚠️ Error dropping User indexes:', error.message);
      }
    }

    // Recreate only the necessary indexes
    try {
      // Email index
      await User.collection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Created User email index');
      
      // Username index (case-insensitive)
      await User.collection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          collation: { locale: 'en', strength: 2 }
        }
      );
      console.log('✅ Created User username index (case-insensitive)');
      
      // Other useful indexes
      await User.collection.createIndex({ role: 1 });
      console.log('✅ Created User role index');
      
      await User.collection.createIndex({ membershipLevel: 1 });
      console.log('✅ Created User membershipLevel index');
      
    } catch (error: any) {
      console.log('⚠️ Error creating User indexes:', error.message);
    }

    // Fix PendingUser collection indexes
    console.log('\n=== FIXING PENDING USER INDEXES ===');
    try {
      // Drop all indexes except _id
      await PendingUser.collection.dropIndexes();
      console.log('✅ Dropped all PendingUser indexes');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️ No PendingUser indexes to drop');
      } else {
        console.log('⚠️ Error dropping PendingUser indexes:', error.message);
      }
    }

    // Recreate only the necessary indexes
    try {
      // Email index
      await PendingUser.collection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Created PendingUser email index');
      
      // Username index (case-insensitive)
      await PendingUser.collection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          collation: { locale: 'en', strength: 2 }
        }
      );
      console.log('✅ Created PendingUser username index (case-insensitive)');
      
      // TTL index for expiration
      await PendingUser.collection.createIndex(
        { expiresAt: 1 }, 
        { 
          expireAfterSeconds: 0,
          name: 'expiresAt_ttl_1'
        }
      );
      console.log('✅ Created PendingUser TTL index');
      
    } catch (error: any) {
      console.log('⚠️ Error creating PendingUser indexes:', error.message);
    }

    console.log('\n✅ Index fix complete!');

  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixDuplicateIndexes(); 