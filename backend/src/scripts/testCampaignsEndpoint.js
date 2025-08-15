#!/usr/bin/env node

/**
 * Test Script for Sender.net Campaigns Endpoint
 * 
 * This script tests the /campaigns endpoint with the correct data structure
 * to verify that transactional emails can be sent through campaigns.
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testCampaignsEndpoint() {
  const apiKey = process.env.SENDER_API_KEY;
  const domain = process.env.SENDER_DOMAIN;
  const listId = process.env.SENDER_LIST_ID;
  const baseUrl = 'https://api.sender.net/v2';

  console.log('🚀 Testing Sender.net Campaigns Endpoint');
  console.log('========================================\n');

  console.log('🔍 Configuration:');
  console.log(`   API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Domain: ${domain || '❌ Missing'}`);
  console.log(`   List ID: ${listId || '❌ Missing'}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log('');

  if (!apiKey || !domain || !listId) {
    console.log('❌ Missing required environment variables!');
    process.exit(1);
  }

  try {
    console.log('🔍 Testing campaigns endpoint with correct data structure...');
    
    const testData = {
      name: 'Test Verification Email',
      subject: 'Test Email Verification',
      html_content: '<h1>Test Email</h1><p>This is a test verification email.</p>',
      text_content: 'Test Email\n\nThis is a test verification email.',
      reply_to: `noreply@${domain}`,
      content_type: 'html',
      list_id: listId
    };

    console.log('📧 Test data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('');

    const response = await axios.post(`${baseUrl}/campaigns`, testData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Campaign created successfully!');
    console.log(`   Campaign ID: ${response.data.id}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    console.log('\n🎉 The campaigns endpoint is working!');
    console.log('   You can now use this for sending transactional emails.');
    console.log('   Update your senderService.ts to use /campaigns instead of /emails.');

  } catch (error) {
    console.log('❌ Campaign creation failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 422) {
        console.log('\n🔧 Validation Error - Check the data structure:');
        console.log('   - Ensure list_id is valid');
        console.log('   - Check that html_content and text_content are provided');
        console.log('   - Verify reply_to email format');
      }
    }

    if (error.request) {
      console.log('   Request was made but no response received');
    }
  }
}

// Run the test
testCampaignsEndpoint().catch(console.error);
