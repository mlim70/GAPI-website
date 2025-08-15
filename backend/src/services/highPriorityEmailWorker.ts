import EmailJob from '../models/emailJob.model';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email/email';
import { connectToDatabase } from '../utils/db';

/**
 * High Priority Email Worker
 * 
 * This worker processes only high-priority emails (verifications, confirmations, security alerts)
 * and should run more frequently than the regular email worker.
 * 
 * Recommended: Run every 30 seconds to 1 minute
 */
export async function processHighPriorityEmails(): Promise<void> {
  try {
    await connectToDatabase();
    
    // Find only high-priority pending jobs
    const highPriorityJobs = await EmailJob.find({
      status: 'pending',
      priority: 'high',
      $or: [
        { nextAttemptAt: { $lte: new Date() } },
        { nextAttemptAt: { $exists: false } }
      ]
    }).limit(5); // Process fewer at a time for high priority
    
    if (highPriorityJobs.length === 0) {
      return; // No high-priority jobs to process
    }
    
    console.log(`🚨 Processing ${highPriorityJobs.length} high-priority email jobs`);
    
    for (const job of highPriorityJobs) {
      try {
        // Mark job as processing
        await EmailJob.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: 'processing',
              attempts: job.attempts + 1
            }
          }
        );
        
        // Process based on job type - only include implemented high-priority email types
        switch (job.type) {
          case 'verification':
            await sendVerificationEmail({
              email: job.recipient.email,
              name: job.data.fullName,
              userId: job.data.userId,
              token: job.data.token
            });
            break;
            
          case 'passwordReset':
            await sendPasswordResetEmail(
              job.recipient.email, 
              job.data.fullName, 
              job.data.userId, 
              job.data.token
            );
            break;
            
          default:
            throw new Error(`Unknown high-priority email job type: ${job.type}`);
        }
        
        // Mark job as completed
        await EmailJob.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: 'completed',
              processedAt: new Date()
            }
          }
        );
        
        console.log(`✅ High-priority email completed: ${job.type} to ${job.recipient.email}`);
        
      } catch (error) {
        console.error(`❌ Failed to process high-priority email job ${job._id}:`, error);
        
        const shouldRetry = job.attempts < job.maxAttempts;
        const nextAttemptDelay = Math.min(Math.pow(2, job.attempts) * 1000, 60000); // Faster retry for high priority (max 1 minute)
        
        if (shouldRetry) {
          // Schedule retry
          await EmailJob.updateOne(
            { _id: job._id },
            { 
              $set: { 
                status: 'pending',
                nextAttemptAt: new Date(Date.now() + nextAttemptDelay),
                errorMessage: error instanceof Error ? error.message : String(error)
              }
            }
          );
          console.log(`🔄 High-priority email job ${job._id} scheduled for retry in ${nextAttemptDelay}ms`);
        } else {
          // Mark as failed after max attempts
          await EmailJob.updateOne(
            { _id: job._id },
            { 
              $set: { 
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : String(error)
              }
            }
          );
          console.log(`💀 High-priority email job ${job._id} marked as failed after ${job.attempts} attempts`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ High priority email worker failed:', error);
  }
}

/**
 * Get high-priority email job statistics
 */
export async function getHighPriorityEmailJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    await connectToDatabase();
    
    const stats = await EmailJob.aggregate([
      {
        $match: { priority: 'high' }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      result[stat._id as keyof typeof result] = stat.count;
      result.total += stat.count;
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to get high-priority email job stats:', error);
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
  }
}
