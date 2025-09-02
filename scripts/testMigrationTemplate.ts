// scripts/testMigrationTemplate.ts
import 'dotenv/config';
import { senderEmailService } from '../backend/src/utils/email/senderService';
import { logger } from '../backend/src/utils/general/logger';

async function testTemplate() {
  if (!senderEmailService.isServiceConfigured()) {
    throw new Error('Sender.net not configured');
  }

  // Test with minimal variables first
  const minimalVariables = {
    name: "Test User",
    reset_link: "http://localhost:5173/reset-password?token=test123&userId=test456",
    username: "testuser",
    currentYear: 2025
  };

  console.log('Testing with minimal variables...');
  try {
    await senderEmailService.sendMigrationPasswordInviteEmail(
      'your-test-email@example.com', // Replace with your email
      'Test User',
      'test-user-id',
      'test-token-123',
      {
        username: 'testuser',
        resetExpiresHours: 24,
        resetExpiresAtDisplay: 'Tomorrow',
        is_lifetime: false,
        is_recurring: false,
        is_expired: false,
        billing_deadline_date: 'N/A',
        billing_portal_link: 'http://localhost:5173/account/billing',
        pricing_page_url: 'http://localhost:5173/become-a-member'
      }
    );
    console.log('✅ Template test successful!');
  } catch (error: any) {
    console.log('❌ Template test failed:', error.message);
    
    // Test with even simpler variables
    console.log('\nTesting with ultra-minimal variables...');
    try {
      const response = await fetch('https://api.sender.net/v2/message/ep2A21/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_email: 'your-test-email@example.com', // Replace with your email
          variables: {
            name: "Test User",
            reset_link: "https://example.com/reset",
            currentYear: 2025
          }
        })
      });
      
      const data = await response.json();
      console.log('Direct API response:', {
        status: response.status,
        statusText: response.statusText,
        data
      });
    } catch (directError: any) {
      console.log('Direct API call also failed:', directError.message);
    }
  }
}

testTemplate().catch(console.error);
