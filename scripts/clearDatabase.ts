// scripts/clearDatabase.ts
import { config } from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
config();

async function clearDatabase() {
  try {
    console.log('🚨 DATABASE CLEARANCE SCRIPT 🚨');
    console.log('This script will DELETE ALL DATA from your MongoDB database.');
    console.log('');
    
    console.log('🔗 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all collections in the database
    const allCollections = await db.listCollections().toArray();
    const collectionNames = allCollections.map(col => col.name);
    
    console.log('');
    console.log('📋 Found collections:', collectionNames);
    console.log('');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Clear each collection
    for (const collectionName of collectionNames) {
      try {
        console.log(`🗑️  Clearing collection: ${collectionName}`);
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`   ✅ Deleted ${result.deletedCount} documents from ${collectionName}`);
        deletedCount += result.deletedCount;
      } catch (error) {
        console.log(`   ❌ Error clearing ${collectionName}:`, error);
        errorCount++;
      }
    }
    
    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Total documents deleted: ${deletedCount}`);
    console.log(`   ✅ Collections processed: ${collectionNames.length - errorCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Collections with errors: ${errorCount}`);
    }
    console.log('');
    console.log('🎉 Database clearance completed!');
    
  } catch (error) {
    console.error('❌ Error during database clearance:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
clearDatabase().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
