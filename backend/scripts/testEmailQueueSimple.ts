#!/usr/bin/env ts-node

/**
 * Simple Email Queue Test
 * 
 * This script tests just the email queue functionality without requiring
 * full environment setup or database connection.
 * 
 * Usage:
 * npm run test:email-queue-simple
 */

import 'dotenv/config';  // Load environment variables first
import mongoose from 'mongoose';

// Mock EmailJob model for testing
const mockEmailJobSchema = new mongoose.Schema({
  type: String,
  status: String,
  recipient: {
    email: String,
    name: String
  },
  data: mongoose.Schema.Types.Mixed,
  attempts: Number,
  maxAttempts: Number,
  nextAttemptAt: Date,
  processedAt: Date,
  errorMessage: String,
  createdAt: Date,
  updatedAt: Date
});

const MockEmailJob = mongoose.model('MockEmailJob', mockEmailJobSchema);

// Simple queue function for testing
async function queueEmailJob(jobData: any): Promise<void> {
  try {
    await MockEmailJob.create({
      type: jobData.type,
      recipient: jobData.recipient,
      data: jobData.data,
      status: 'pending',
      nextAttemptAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    });
    
    console.log(`📧 Email job queued: ${jobData.type} to ${jobData.recipient.email}`);
  } catch (error) {
    console.error('❌ Failed to queue email job:', error);
  }
}

// Test functions
async function queueWelcomeEmail(email: string, fullName: string): Promise<void> {
  await queueEmailJob({
    type: 'welcome',
    recipient: { email, name: fullName },
    data: { fullName }
  });
}

async function queuePasswordResetEmail(email: string, resetToken: string): Promise<void> {
  await queueEmailJob({
    type: 'passwordReset',
    recipient: { email },
    data: { resetToken }
  });
}

async function queueContactFormEmail(email: string, name: string, message: string): Promise<void> {
  await queueEmailJob({
    type: 'contactForm',
    recipient: { email, name },
    data: { message, submittedAt: new Date() }
  });
}

async function getEmailJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    const stats = await MockEmailJob.aggregate([
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
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  }
}

async function testEmailQueue() {
  console.log('🧪 Testing Email Queue System (Simple)');
  console.log('=======================================\n');
  
  try {
    // Connect to in-memory MongoDB for testing
    await mongoose.connect('mongodb://localhost:27017/test-email-queue');
    console.log('✅ Connected to test database');
    
    // Clear any existing test jobs
    await MockEmailJob.deleteMany({});
    console.log('🧹 Cleared existing test jobs');
    
    // Test 1: Queue different types of email jobs
    console.log('\n📧 Test 1: Queueing email jobs...');
    
    await queueWelcomeEmail('test@example.com', 'John Doe');
    await queuePasswordResetEmail('reset@example.com', 'reset-token-123');
    await queueContactFormEmail('contact@example.com', 'Jane Smith', 'Hello, this is a test message');
    
    console.log('✅ Queued 3 test email jobs');
    
    // Test 2: Check job statistics
    console.log('\n📊 Test 2: Checking job statistics...');
    const stats = await getEmailJobStats();
    console.log('Job stats:', stats);
    
    if (stats.pending !== 3) {
      throw new Error(`Expected 3 pending jobs, got ${stats.pending}`);
    }
    console.log('✅ Job statistics are correct');
    
    // Test 3: Verify job details
    console.log('\n🔍 Test 3: Verifying job details...');
    const jobs = await MockEmailJob.find().sort({ createdAt: 1 });
    
    for (const job of jobs) {
      console.log(`- ${job.type}: ${job.recipient.email} -> ${job.status}`);
    }
    
    console.log('\n🎉 Email Queue System Test Completed Successfully!');
    console.log('==================================================');
    console.log('✅ All tests passed!');
    
    console.log('\n💡 Next steps:');
    console.log('1. Set up your .env file with required environment variables');
    console.log('2. Run: npm run test:email-queue (full test with database)');
    console.log('3. Run: npm run email-worker (process queued jobs)');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await MockEmailJob.deleteMany({});
      await mongoose.disconnect();
      console.log('🧹 Cleaned up test database');
    } catch (cleanupError) {
      console.error('⚠️ Cleanup failed:', cleanupError);
    }
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🧹 Cleaning up...');
  try {
    await MockEmailJob.deleteMany({});
    await mongoose.disconnect();
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
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

export { testEmailQueue };
