//backend/src/services/emailWorker.ts
import EmailJob from '../models/emailJob.model';
import { sendWelcomeEmail, sendPasswordResetEmail, sendContactFormEmail, sendVerificationEmail } from '../utils/email/email';
import { connectToDatabase } from '../utils/db';

/**
 * Process pending email jobs
 * This should be run as a cron job or separate worker process
 */
export async function processEmailJobs(): Promise<void> {
  try {
    await connectToDatabase();
    
    // Find jobs that are ready to be processed, prioritizing high-priority emails
    const pendingJobs = await EmailJob.find({
      status: 'pending',
      $or: [
        { nextAttemptAt: { $lte: new Date() } },
        { nextAttemptAt: { $exists: false } }
      ]
    })
    .sort({ priorityWeight: -1, createdAt: 1 }) // High priority first, then by creation time
    .limit(10); // Process in batches
    
    if (pendingJobs.length === 0) {
      console.log('📧 No pending email jobs to process');
      return;
    }
    
    console.log(`📧 Processing ${pendingJobs.length} email jobs`);
    
    for (const job of pendingJobs) {
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
        
        // Process based on job type - only include implemented email types
        switch (job.type) {
          case 'welcome':
            await sendWelcomeEmail(job.recipient.email, job.data.fullName);
            break;
            
          case 'passwordReset':
            await sendPasswordResetEmail(
              job.recipient.email, 
              job.data.fullName, 
              job.data.userId, 
              job.data.token
            );
            break;
            
          case 'contactForm':
            await sendContactFormEmail({
              name: job.data.name,
              email: job.data.email,
              subject: job.data.subject,
              message: job.data.message,
              date: job.data.date
            });
            break;
            
          case 'verification':
            await sendVerificationEmail({
              email: job.recipient.email,
              name: job.data.fullName,
              token: job.data.token
            });
            break;
            
          default:
            throw new Error(`Unknown email job type: ${job.type}`);
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
        
        console.log(`✅ Email job completed: ${job.type} to ${job.recipient.email}`);
        
      } catch (error) {
        console.error(`❌ Failed to process email job ${job._id}:`, error);
        
        const shouldRetry = job.attempts < job.maxAttempts;
        const nextAttemptDelay = Math.min(Math.pow(2, job.attempts) * 1000, 300000); // Exponential backoff, max 5 minutes
        
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
          console.log(`🔄 Email job ${job._id} scheduled for retry in ${nextAttemptDelay}ms`);
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
          console.log(`💀 Email job ${job._id} marked as failed after ${job.attempts} attempts`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Email worker failed:', error);
  }
}

/**
 * Clean up old completed/failed jobs (older than 30 days)
 */
export async function cleanupOldEmailJobs(): Promise<void> {
  try {
    await connectToDatabase();
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await EmailJob.deleteMany({
      status: { $in: ['completed', 'failed'] },
      updatedAt: { $lt: thirtyDaysAgo }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old email jobs`);
    }
    
  } catch (error) {
    console.error('❌ Failed to cleanup old email jobs:', error);
  }
}

/**
 * Get email job statistics
 */
export async function getEmailJobStats(): Promise<{
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
    console.error('❌ Failed to get email job stats:', error);
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
  }
}
