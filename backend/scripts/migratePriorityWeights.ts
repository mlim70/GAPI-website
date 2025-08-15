import mongoose from 'mongoose';
import EmailJob from '../src/models/emailJob.model';
import { connectToDatabase } from '../src/utils/db';

/**
 * Migration script to add priorityWeight field to existing email jobs
 * Run this after updating the schema to ensure existing documents have the correct weights
 */
async function migratePriorityWeights(): Promise<void> {
  try {
    console.log('🔄 Starting priority weight migration...');
    
    await connectToDatabase();
    
    // Update all documents that don't have priorityWeight set
    const result = await EmailJob.updateMany(
      { priorityWeight: { $exists: false } },
      [
        {
          $set: {
            priorityWeight: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'high'] }, then: 3 },
                  { case: { $eq: ['$priority', 'low'] }, then: 1 }
                ],
                default: 2 // medium priority
              }
            }
          }
        }
      ]
    );
    
    console.log(`✅ Migration completed! Updated ${result.modifiedCount} email jobs`);
    
    // Verify the migration
    const stats = await EmailJob.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          avgWeight: { $avg: '$priorityWeight' }
        }
      }
    ]);
    
    console.log('📊 Priority weight statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} jobs, avg weight: ${stat.avgWeight}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePriorityWeights()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default migratePriorityWeights;
