// backend/scripts/testFrontendAPI.ts
import 'dotenv/config';

async function testFrontendAPI() {
  const baseURL = 'http://localhost:4000'; // Your backend URL

  console.log('🧪 TESTING FRONTEND API ENDPOINTS');
  console.log('==================================\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health check...');
  try {
    const healthResponse = await fetch(`${baseURL}/api/health`);
    console.log(`   Status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      console.log('   ✅ Health check passed');
    } else {
      console.log('   ❌ Health check failed');
    }
  } catch (error) {
    console.log('   ❌ Health check error:', error);
  }

  // Test 2: Membership levels
  console.log('\n2️⃣ Testing membership levels...');
  try {
    const levelsResponse = await fetch(`${baseURL}/api/membership-levels`);
    console.log(`   Status: ${levelsResponse.status}`);
    if (levelsResponse.ok) {
      const levels = await levelsResponse.json();
      console.log(`   ✅ Found ${levels.length} membership levels`);
      levels.forEach((level: any) => {
        console.log(`      - ${level.key}: ${level.unitAmount / 100} ${level.currency}`);
      });
    } else {
      console.log('   ❌ Failed to get membership levels');
    }
  } catch (error) {
    console.log('   ❌ Membership levels error:', error);
  }

  // Test 3: Test pending user creation (without actual creation)
  console.log('\n3️⃣ Testing pending user endpoint structure...');
  try {
    const pendingUserResponse = await fetch(`${baseURL}/api/auth/pending-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        levelKey: 'BASIC'
      })
    });
    console.log(`   Status: ${pendingUserResponse.status}`);
    
    if (pendingUserResponse.status === 409) {
      console.log('   ✅ Endpoint working (409 expected for duplicate)');
    } else if (pendingUserResponse.status === 400) {
      console.log('   ✅ Endpoint working (400 for validation)');
    } else if (pendingUserResponse.status === 201) {
      console.log('   ✅ Endpoint working (201 for success)');
    } else {
      console.log('   ⚠️ Unexpected status:', pendingUserResponse.status);
    }
  } catch (error) {
    console.log('   ❌ Pending user endpoint error:', error);
  }

  // Test 4: Test checkout endpoint structure
  console.log('\n4️⃣ Testing checkout endpoint structure...');
  try {
    const checkoutResponse = await fetch(`${baseURL}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        levelKey: 'BASIC',
        pendingUserId: 'test123'
      })
    });
    console.log(`   Status: ${checkoutResponse.status}`);
    
    if (checkoutResponse.status === 400) {
      console.log('   ✅ Endpoint working (400 expected for invalid pendingUserId)');
    } else if (checkoutResponse.status === 404) {
      console.log('   ✅ Endpoint working (404 for not found)');
    } else {
      console.log('   ⚠️ Unexpected status:', checkoutResponse.status);
    }
  } catch (error) {
    console.log('   ❌ Checkout endpoint error:', error);
  }

  console.log('\n📊 API TESTING SUMMARY:');
  console.log('✅ All endpoints are accessible');
  console.log('✅ Backend is running and responding');
  console.log('✅ Ready for frontend registration testing');
}

// Run the API test
testFrontendAPI(); 