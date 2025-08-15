#!/usr/bin/env ts-node

/**
 * Test Email Queue System
 * 
 * This script tests the email queue functionality by creating test jobs
 * and then processing them.
 * 
 * Usage:
 * npm run test:email-queue
 */

import 'dotenv/config';  // Load environment variables first
import { connectToDatabase } from '../src/utils/db';
import { 
  queueWelcomeEmail, 
  queuePasswordResetEmail, 
  queueContactFormEmail,
  queueNewsletterEmail,
  queueVerificationEmail 
} from '../src/utils/email/emailQueue';
import { processEmailJobs, getEmailJobStats } from '../src/services/emailWorker';
import EmailJob from '../src/models/emailJob.model';

async function testEmailQueue() {
  console.log('🧪 Testing Email Queue System');
  console.log('==============================\n');
  
  try {
    // Connect to database
    await connectToDatabase();
    console.log('✅ Connected to database');
    
    // Clear any existing test jobs
    await EmailJob.deleteMany({});
    console.log('🧹 Cleared existing test jobs');
    
    // Test 1: Queue different types of email jobs
    console.log('\n📧 Test 1: Queueing email jobs...');
    
    await queueWelcomeEmail('test@example.com', 'John Doe');
    await queuePasswordResetEmail('reset@example.com', 'reset-token-123');
    await queueContactFormEmail('contact@example.com', 'Jane Smith', 'Hello, this is a test message');
    await queueNewsletterEmail('newsletter@example.com', 'weekly');
    await queueVerificationEmail('verify@example.com', 'verify-token-456');
    
    console.log('✅ Queued 5 test email jobs');
    
    // Test 2: Check job statistics
    console.log('\n📊 Test 2: Checking job statistics...');
    const stats = await getEmailJobStats();
    console.log('Job stats:', stats);
    
    if (stats.pending !== 5) {
      throw new Error(`Expected 5 pending jobs, got ${stats.pending}`);
    }
    console.log('✅ Job statistics are correct');
    
    // Test 3: Process email jobs
    console.log('\n⚙️ Test 3: Processing email jobs...');
    await processEmailJobs();
    
    // Test 4: Check final statistics
    console.log('\n📊 Test 4: Checking final statistics...');
    const finalStats = await getEmailJobStats();
    console.log('Final job stats:', finalStats);
    
    // Test 5: Verify job details
    console.log('\n🔍 Test 5: Verifying job details...');
    const jobs = await EmailJob.find().sort({ createdAt: 1 });
    
    for (const job of jobs) {
      console.log(`- ${job.type}: ${job.recipient.email} -> ${job.status}`);
      if (job.status === 'failed') {
        console.log(`  Error: ${job.errorMessage}`);
      }
    }
    
    console.log('\n🎉 Email Queue System Test Completed!');
    console.log('=====================================');
    
    if (finalStats.completed > 0) {
      console.log('✅ Some emails were processed successfully');
    } else {
      console.log('⚠️ No emails were processed (this is normal if email service is not configured)');
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Configure your email service in .env');
    console.log('2. Run: npm run email-worker');
    console.log('3. Check logs for email delivery status');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function cleanup() {
  try {
    await connectToDatabase();
    await EmailJob.deleteMany({});
    console.log('🧹 Cleaned up test jobs');
  } catch (error) {
    console.error('⚠️ Cleanup failed:', error);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🧹 Cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🧹 Cleaning up...');
  await cleanup();
  process.exit(0);
});

if (require.main === module) {
  testEmailQueue().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export { testEmailQueue, cleanup };
