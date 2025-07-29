// backend/scripts/simulateRegistration.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import { normalizeEmail } from '../src/utils/emailUtils';
import { normalizeUsername } from '../src/utils/usernameUtils';

interface TestUser {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  levelKey: string;
}

async function simulateRegistration() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test cases with different scenarios
    const testUsers: TestUser[] = [
      {
        email: 'test1@gmail.com',
        username: 'testuser1',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User1',
        levelKey: 'BASIC'
      },
      {
        email: 'TEST2@GMAIL.COM',
        username: 'TestUser2',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User2',
        levelKey: 'PREMIUM'
      },
      {
        email: 'test3+tag@gmail.com',
        username: 'test-user-3',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User3',
        levelKey: 'BASIC'
      },
      {
        email: 'test4.tag@gmail.com',
        username: 'test_user_4',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User4',
        levelKey: 'PREMIUM'
      }
    ];

    console.log('🧪 SIMULATING USER REGISTRATION PIPELINE\n');

    for (let i = 0; i < testUsers.length; i++) {
      const testUser = testUsers[i];
      console.log(`\n--- Test Case ${i + 1}: ${testUser.email} (${testUser.username}) ---`);
      
      // Step 1: Normalize the input data
      const normalizedEmail = normalizeEmail(testUser.email);
      const normalizedUsername = normalizeUsername(testUser.username);
      
      console.log(`📝 Input: ${testUser.email} -> Normalized: ${normalizedEmail}`);
      console.log(`📝 Input: ${testUser.username} -> Normalized: ${normalizedUsername}`);

      // Step 2: Check for existing User (permanent)
      console.log('\n🔍 Step 2: Checking for existing User...');
      const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
      });

      if (existingUser) {
        console.log(`❌ User already exists! Matched on: ${existingUser.email === normalizedEmail ? 'email' : 'username'}`);
        continue;
      } else {
        console.log('✅ No existing User found');
      }

      // Step 3: Check for existing PendingUser
      console.log('\n🔍 Step 3: Checking for existing PendingUser...');
      const existingPendingUser = await PendingUser.findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
      });

      if (existingPendingUser) {
        console.log(`❌ PendingUser already exists! ID: ${existingPendingUser._id}`);
        console.log(`   Expires: ${existingPendingUser.expiresAt.toISOString()}`);
        const isExpired = existingPendingUser.expiresAt < new Date();
        console.log(`   Is expired: ${isExpired}`);
        
        if (isExpired) {
          console.log('🗑️ Cleaning up expired PendingUser...');
          await CheckoutSession.deleteMany({ pendingUserId: existingPendingUser._id });
          await PendingUser.findByIdAndDelete(existingPendingUser._id);
          console.log('✅ Expired PendingUser cleaned up');
        } else {
          console.log('⏳ PendingUser is still valid, skipping...');
          continue;
        }
      } else {
        console.log('✅ No existing PendingUser found');
      }

      // Step 4: Create PendingUser
      console.log('\n📝 Step 4: Creating PendingUser...');
      try {
        const pendingUser = await PendingUser.create({
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash: 'simulated_hash_for_testing',
          name: { first: testUser.firstName, last: testUser.lastName },
          levelKey: testUser.levelKey,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        console.log(`✅ PendingUser created successfully! ID: ${pendingUser._id}`);

        // Step 5: Create CheckoutSession
        console.log('\n💳 Step 5: Creating CheckoutSession...');
        const checkoutSession = await CheckoutSession.create({
          pendingUserId: pendingUser._id,
          pendingUserEmail: pendingUser.email,
          stripeSessionId: 'SIMULATED_SESSION_ID',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        console.log(`✅ CheckoutSession created successfully! ID: ${checkoutSession._id}`);

        // Step 6: Simulate successful payment (create actual User)
        console.log('\n✅ Step 6: Simulating successful payment...');
        const actualUser = await User.create({
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash: 'simulated_hash_for_testing',
          name: { first: testUser.firstName, last: testUser.lastName },
          role: 'subscriber',
          membershipLevel: testUser.levelKey
        });
        console.log(`✅ User created successfully! ID: ${actualUser._id}`);

        // Step 7: Clean up PendingUser and CheckoutSession
        console.log('\n🧹 Step 7: Cleaning up temporary records...');
        await CheckoutSession.findByIdAndDelete(checkoutSession._id);
        await PendingUser.findByIdAndDelete(pendingUser._id);
        console.log('✅ Temporary records cleaned up');

        console.log(`\n🎉 Registration pipeline completed successfully for ${testUser.email}!`);

      } catch (error: any) {
        console.error(`❌ Error in registration pipeline:`, error.message);
        if (error.code === 11000) {
          console.error('   This is a duplicate key error - likely a race condition or existing data');
        }
      }
    }

    // Final verification
    console.log('\n\n📊 FINAL VERIFICATION:');
    const finalUsers = await User.find({});
    const finalPendingUsers = await PendingUser.find({});
    const finalCheckoutSessions = await CheckoutSession.find({});

    console.log(`✅ Total Users: ${finalUsers.length}`);
    console.log(`✅ Total PendingUsers: ${finalPendingUsers.length}`);
    console.log(`✅ Total CheckoutSessions: ${finalCheckoutSessions.length}`);

    if (finalUsers.length > 0) {
      console.log('\n📋 Created Users:');
      finalUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - ${user.membershipLevel}`);
      });
    }

  } catch (error) {
    console.error('Error simulating registration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the simulation
simulateRegistration(); 