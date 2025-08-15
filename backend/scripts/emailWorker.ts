#!/usr/bin/env ts-node

import 'dotenv/config';  // Load environment variables first
import { processEmailJobs, cleanupOldEmailJobs, getEmailJobStats } from '../src/services/emailWorker';

/**
 * Email Worker Script
 * 
 * This script can be run as a cron job to process queued email jobs.
 * 
 * Example cron job (every 5 minutes):
 * */5 * * * * cd /path/to/backend && npm run email-worker
 * 
 * Or run manually:
 * npm run email-worker
 */

async function main() {
  console.log('📧 Starting email worker...');
  console.log('⏰', new Date().toISOString());
  
  try {
    // Process pending email jobs
    await processEmailJobs();
    
    // Clean up old jobs (run less frequently)
    if (Math.random() < 0.2) { // 20% chance to run cleanup
      console.log('🧹 Running cleanup...');
      await cleanupOldEmailJobs();
    }
    
    // Show stats
    const stats = await getEmailJobStats();
    console.log('📊 Email job stats:', stats);
    
    console.log('✅ Email worker completed successfully');
    
  } catch (error) {
    console.error('❌ Email worker failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };
