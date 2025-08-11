// Simple test script for Mailgun connection
// Run with: node test-mailgun.js

require('dotenv').config();

async function testMailgun() {
  try {
    console.log('🔧 Testing Mailgun connection...');
    
    // Check environment variables
    if (!process.env.MAILGUN_API_KEY) {
      console.error('❌ MAILGUN_API_KEY not found in environment variables');
      console.log('💡 Please add MAILGUN_API_KEY to your .env file');
      return;
    }
    
    if (!process.env.MAILGUN_DOMAIN) {
      console.error('❌ MAILGUN_DOMAIN not found in environment variables');
      console.log('💡 Please add MAILGUN_DOMAIN to your .env file');
      return;
    }
    
    console.log('✅ Environment variables found:');
    console.log(`   Domain: ${process.env.MAILGUN_DOMAIN}`);
    console.log(`   API Key length: ${process.env.MAILGUN_API_KEY.length}`);
    
    // Dynamic imports
    const formData = (await import('form-data')).default;
    const Mailgun = (await import('mailgun.js')).default;
    
    // Initialize Mailgun client
    const mg = new Mailgun(formData).client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    });
    
    console.log('✅ Mailgun client initialized');
    
    // Test email parameters
    const testEmail = {
      from: `GAPI <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: 'your-email@example.com', // Change this to your email
      subject: 'Test email from GAPI Mailgun',
      text: 'This is a test email to verify your Mailgun connection is working!',
    };
    
    console.log('📧 Sending test email...');
    console.log(`   To: ${testEmail.to}`);
    console.log(`   From: ${testEmail.from}`);
    console.log(`   Subject: ${testEmail.subject}`);
    
    // Send test email
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, testEmail);
    
    console.log('✅ Test email sent successfully!');
    console.log('   Message ID:', result.id);
    console.log('   Response:', result);
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    
    if (error.status) {
      console.error('   Status:', error.status);
    }
    
    if (error.details) {
      console.error('   Details:', error.details);
    }
    
    // Common error troubleshooting
    if (error.message.includes('Forbidden')) {
      console.log('💡 This usually means your API key is invalid or expired');
    } else if (error.message.includes('Domain not found')) {
      console.log('💡 Check that your MAILGUN_DOMAIN is correct');
    } else if (error.message.includes('Unauthorized')) {
      console.log('💡 Check that your MAILGUN_API_KEY is correct');
    }
  }
}

// Run the test
testMailgun();
