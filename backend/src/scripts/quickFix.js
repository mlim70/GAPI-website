#!/usr/bin/env node

/**
 * Quick Fix Script for Sender.net Issues
 * 
 * This script provides immediate solutions for common Sender.net problems
 * without running the full test suite.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 SENDER.NET QUICK FIX SCRIPT');
console.log('================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('   Create a .env file in the backend directory with:');
  console.log('   SENDER_API_KEY=your_api_key');
  console.log('   SENDER_DOMAIN=yourdomain.com');
  console.log('   SENDER_LIST_ID=your_list_id');
  console.log('\n   Then run: npm run test:sender:js');
  process.exit(1);
}

// Load and check environment variables
require('dotenv').config({ path: envPath });

const apiKey = process.env.SENDER_API_KEY;
const domain = process.env.SENDER_DOMAIN;
const listId = process.env.SENDER_LIST_ID;

console.log('🔍 Quick Environment Check:');
console.log(`   API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
console.log(`   Domain: ${domain ? '✅ Present' : '❌ Missing'}`);
console.log(`   List ID: ${listId ? '✅ Present' : '❌ Missing'}`);

if (!apiKey || !domain || !listId) {
  console.log('\n❌ Missing required environment variables!');
  console.log('   Please check your .env file and ensure all variables are set.');
  process.exit(1);
}

console.log('\n✅ Environment variables look good!');
console.log('\n🔧 Common Solutions for 404 Errors:');

console.log('\n1. **Endpoint Issue** - The /emails endpoint might not be available in your plan');
console.log('   Try updating your senderService.ts to use /transactions instead:');
console.log('   Change: /emails → /transactions');

console.log('\n2. **Plan Limitations** - Check your Sender.net subscription plan');
console.log('   - Free plans may have limited endpoints');
console.log('   - Some features require paid plans');

console.log('\n3. **API Version** - Verify you\'re using the correct API version');
console.log('   Current: https://api.sender.net/v2');
console.log('   Check Sender.net documentation for your plan');

console.log('\n4. **Alternative Endpoints** - Try these instead of /emails:');
console.log('   - /transactions (for transactional emails)');
console.log('   - /campaigns (for marketing emails)');
console.log('   - /templates (for template-based emails)');

console.log('\n🚀 Next Steps:');
console.log('   1. Run the full test: npm run test:sender:js');
console.log('   2. Check Sender.net dashboard for plan features');
console.log('   3. Try alternative endpoints');
console.log('   4. Contact Sender.net support if issues persist');

console.log('\n📚 Resources:');
console.log('   - Sender.net API Docs: https://www.sender.net/api-docs/');
console.log('   - Sender.net Status: https://status.sender.net/');
console.log('   - Full Test Script: npm run test:sender:js');

console.log('\n' + '='.repeat(50));
console.log('💡 Tip: Run "npm run test:sender:js" for detailed diagnostics');
console.log('='.repeat(50));
