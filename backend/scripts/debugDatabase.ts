// backend/scripts/debugDatabase.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import { normalizeEmail } from '../src/utils/emailUtils';
import { normalizeUsername } from '../src/utils/usernameUtils';

async function debugDatabase() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check Users collection
    console.log('\n=== USERS COLLECTION ===');
    const users = await User.find({});
    console.log(`Total users: ${users.length}`);
    if (users.length > 0) {
      users.forEach(user => {
        console.log(`- User: ${user.email} (${user.username}) - ID: ${user._id}`);
      });
    }

    // Check PendingUsers collection
    console.log('\n=== PENDING USERS COLLECTION ===');
    const pendingUsers = await PendingUser.find({});
    console.log(`Total pending users: ${pendingUsers.length}`);
    if (pendingUsers.length > 0) {
      pendingUsers.forEach(pendingUser => {
        console.log(`- Pending: ${pendingUser.email} (${pendingUser.username}) - ID: ${pendingUser._id} - Expires: ${pendingUser.expiresAt}`);
      });
    }

    // Test normalization with some example values
    console.log('\n=== NORMALIZATION TEST ===');
    const testEmails = ['test@gmail.com', 'TEST@gmail.com', 'test+tag@gmail.com', 'test.tag@gmail.com'];
    const testUsernames = ['testuser', 'TestUser', 'test-user', 'test_user'];
    
    testEmails.forEach(email => {
      const normalized = normalizeEmail(email);
      console.log(`Email: "${email}" -> "${normalized}"`);
    });
    
    testUsernames.forEach(username => {
      const normalized = normalizeUsername(username);
      console.log(`Username: "${username}" -> "${normalized}"`);
    });

    // Check database indexes
    console.log('\n=== DATABASE INDEXES ===');
    try {
      const userIndexes = await User.collection.getIndexes();
      console.log('User indexes:', Object.keys(userIndexes));
      
      const pendingUserIndexes = await PendingUser.collection.getIndexes();
      console.log('PendingUser indexes:', Object.keys(pendingUserIndexes));
    } catch (error) {
      console.log('Error getting indexes:', error);
    }

  } catch (error) {
    console.error('Error debugging database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
debugDatabase(); 