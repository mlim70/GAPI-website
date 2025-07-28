// test-checkout.js
// Simple test script to verify the checkout API endpoint

const API_BASE = 'http://localhost:4000';

async function testCheckout() {
  console.log('🧪 Testing Stripe Checkout API...\n');

  try {
    // First, get available membership levels
    console.log('1. Fetching membership levels...');
    const levelsResponse = await fetch(`${API_BASE}/api/membership-levels`);
    
    if (!levelsResponse.ok) {
      throw new Error(`Failed to fetch levels: ${levelsResponse.status}`);
    }
    
    const levels = await levelsResponse.json();
    console.log(`✅ Found ${levels.length} membership levels`);
    
    if (levels.length === 0) {
      console.log('⚠️  No membership levels found. Please create some in Stripe first.');
      return;
    }

    // Use the first level for testing
    const testLevel = levels[0];
    console.log(`📋 Testing with level: ${testLevel.name} (${testLevel.key})`);

    // Test the checkout endpoint
    console.log('\n2. Testing checkout endpoint...');
    const checkoutResponse = await fetch(`${API_BASE}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        levelKey: testLevel.key,
        userId: 'test-user-123',
      }),
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text();
      throw new Error(`Checkout failed: ${checkoutResponse.status} - ${errorText}`);
    }

    const checkoutData = await checkoutResponse.json();
    console.log('✅ Checkout session created successfully!');
    console.log(`🔗 Stripe URL: ${checkoutData.url}`);
    
    console.log('\n🎉 Happy-path checkout test passed!');
    console.log('\nNext steps:');
    console.log('1. Open the Stripe URL in your browser');
    console.log('2. Use test card: 4242 4242 4242 4242');
    console.log('3. Complete the payment to test the full flow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure the backend server is running on port 4000');
    console.log('2. Check that MongoDB is connected');
    console.log('3. Verify your Stripe keys are set in .env');
    console.log('4. Ensure membership levels exist in your database');
  }
}

// Run the test
testCheckout(); 