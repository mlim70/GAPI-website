#!/usr/bin/env node

/**
 * Test Script for Sender.net Transactional Campaigns
 * 
 * This script tests the complete transactional email flow:
 * 1. Create a campaign
 * 2. Send it to a specific recipient
 * 
 * Based on Sender.net API documentation for transactional campaigns.
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testTransactionalCampaigns() {
  const apiKey = process.env.SENDER_API_KEY;
  const domain = process.env.SENDER_DOMAIN;
  const baseUrl = 'https://api.sender.net/v2';

  console.log('🚀 Testing Sender.net Transactional Campaigns');
  console.log('============================================\n');

  console.log('🔍 Configuration:');
  console.log(`   API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Domain: ${domain || '❌ Missing'}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log('');

  if (!apiKey || !domain) {
    console.log('❌ Missing required environment variables!');
    process.exit(1);
  }

  try {
    // Step 1: Create a transactional campaign
    console.log('📧 Step 1: Creating transactional campaign...');
    
    const campaignData = {
      name: 'Test Verification Email Campaign',
      subject: 'Test Email Verification',
      html_content: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
        </head>
        <body>
          <h1>Welcome to GAPI!</h1>
          <p>Hello {{recipient_name}},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="https://gapi.org/verify?token=test123">Verify Email</a></p>
          <p>If you didn't create this account, please ignore this email.</p>
          <p>Best regards,<br>The GAPI Team</p>
        </body>
        </html>
      `,
      text_content: `
        Welcome to GAPI!
        
        Hello {{recipient_name}},
        
        Please verify your email address by clicking the link below:
        https://gapi.org/verify?token=test123
        
        If you didn't create this account, please ignore this email.
        
        Best regards,
        The GAPI Team
      `,
      reply_to: `noreply@${domain}`,
      content_type: 'html'
    };

    console.log('📧 Campaign data:');
    console.log(JSON.stringify(campaignData, null, 2));
    console.log('');

    const campaignResponse = await axios.post(`${baseUrl}/campaigns`, campaignData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const campaignId = campaignResponse.data.id;
    console.log(`✅ Campaign created successfully!`);
    console.log(`   Campaign ID: ${campaignId}`);
    console.log(`   Status: ${campaignResponse.status}`);
    console.log(`   Response:`, JSON.stringify(campaignResponse.data, null, 2));
    console.log('');

    // Step 2: Send the transactional campaign to a specific recipient
    console.log('📧 Step 2: Sending transactional campaign...');
    
    const sendData = {
      recipient_email: 'test@example.com', // Replace with a real email for testing
      variables: {
        recipient_name: 'Test User'
      }
    };

    console.log('📧 Send data:');
    console.log(JSON.stringify(sendData, null, 2));
    console.log('');

    const sendResponse = await axios.post(`${baseUrl}/message/${campaignId}/send`, sendData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Transactional email sent successfully!`);
    console.log(`   Campaign ID: ${campaignId}`);
    console.log(`   Email ID: ${sendResponse.data.emailId}`);
    console.log(`   Status: ${sendResponse.status}`);
    console.log(`   Response:`, JSON.stringify(sendResponse.data, null, 2));

    console.log('\n🎉 Transactional campaigns are working!');
    console.log('   This is the correct approach for sending individual emails.');
    console.log('   Your senderService.ts has been updated to use this method.');

  } catch (error) {
    console.log('❌ Transactional campaign test failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 422) {
        console.log('\n🔧 Validation Error - Check the data structure:');
        console.log('   - Ensure all required fields are provided');
        console.log('   - Check that html_content and text_content are valid');
        console.log('   - Verify reply_to email format');
      } else if (error.response.status === 403) {
        console.log('\n🔒 Access Denied - This may require a Pro plan:');
        console.log('   - Transactional campaigns require Sender.net Pro plan');
        console.log('   - Check your subscription level');
        console.log('   - Contact Sender.net support for plan upgrade');
      }
    }

    if (error.request) {
      console.log('   Request was made but no response received');
    }
  }
}

// Run the test
testTransactionalCampaigns().catch(console.error);
