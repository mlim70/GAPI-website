#!/usr/bin/env ts-node

/**
 * Cron Job Setup Script
 * 
 * This script provides instructions for setting up cron jobs to run the email worker.
 * 
 * Usage:
 * npm run setup-cron
 */

import 'dotenv/config';  // Load environment variables first
import { execSync } from 'child_process';
import * as path from 'path';

function getCurrentDirectory(): string {
  return process.cwd();
}

function getBackendPath(): string {
  return path.resolve(getCurrentDirectory());
}

function getEmailWorkerPath(): string {
  return path.join(getBackendPath(), 'scripts', 'emailWorker.ts');
}

function getPackageJsonPath(): string {
  return path.join(getBackendPath(), 'package.json');
}

function checkIfCronInstalled(): boolean {
  try {
    execSync('crontab -l', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log('📅 Email Worker Cron Job Setup');
  console.log('================================\n');
  
  const backendPath = getBackendPath();
  const emailWorkerPath = getEmailWorkerPath();
  const packageJsonPath = getPackageJsonPath();
  
  console.log('📍 Backend directory:', backendPath);
  console.log('📧 Email worker script:', emailWorkerPath);
  console.log('📦 Package.json:', packageJsonPath);
  console.log('');
  
  // Check if cron is available
  if (checkIfCronInstalled()) {
    console.log('✅ Cron is available on this system');
  } else {
    console.log('⚠️  Cron may not be available on this system');
  }
  
  console.log('\n📋 Manual Setup Instructions:');
  console.log('==============================\n');
  
  console.log('1. Open your crontab:');
  console.log('   crontab -e\n');
  
  console.log('2. Add one of these lines to run the email worker:');
  console.log('');
  console.log('   # Every 5 minutes (recommended for development):');
  console.log(`   */5 * * * * cd ${backendPath} && npm run email-worker >> logs/email-worker.log 2>&1`);
  console.log('');
  console.log('   # Every 10 minutes (recommended for production):');
  console.log(`   */10 * * * * cd ${backendPath} && npm run email-worker >> logs/email-worker.log 2>&1`);
  console.log('');
  console.log('   # Every hour:');
  console.log(`   0 * * * * cd ${backendPath} && npm run email-worker >> logs/email-worker.log 2>&1`);
  console.log('');
  
  console.log('3. Create logs directory (optional):');
  console.log(`   mkdir -p ${backendPath}/logs`);
  console.log('');
  
  console.log('4. Test the email worker manually:');
  console.log(`   cd ${backendPath}`);
  console.log('   npm run email-worker');
  console.log('');
  
  console.log('5. Monitor the logs:');
  console.log(`   tail -f ${backendPath}/logs/email-worker.log`);
  console.log('');
  
  console.log('📝 Alternative: Use PM2 for process management');
  console.log('==============================================\n');
  console.log('1. Install PM2: npm install -g pm2');
  console.log('2. Create ecosystem.config.js:');
  console.log('   module.exports = {');
  console.log('     apps: [{');
  console.log('       name: "email-worker",');
  console.log('       script: "npm",');
  console.log('       args: "run email-worker",');
  console.log('       cwd: "' + backendPath + '",');
  console.log('       cron_restart: "*/5 * * * *",');
  console.log('       autorestart: false,');
  console.log('       watch: false');
  console.log('     }]');
  console.log('   }');
  console.log('');
  console.log('3. Start: pm2 start ecosystem.config.js');
  console.log('4. Monitor: pm2 logs email-worker');
  console.log('');
  
  console.log('🔍 Current cron jobs:');
  console.log('======================\n');
  
  try {
    const cronJobs = execSync('crontab -l 2>/dev/null || echo "No cron jobs found"', { encoding: 'utf8' });
    console.log(cronJobs);
  } catch (error) {
    console.log('No cron jobs found or cron not available');
  }
}

if (require.main === module) {
  main();
}

export { main };
