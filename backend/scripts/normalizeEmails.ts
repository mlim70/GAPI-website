// backend/scripts/normalizeEmails.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import { normalizeEmail } from '../src/utils/emailUtils';

async function normalizeExistingEmails() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Normalize emails in User collection
    console.log('Normalizing emails in User collection...');
    const users = await User.find({});
    let userUpdates = 0;

    for (const user of users) {
      const normalizedEmail = normalizeEmail(user.email);
      if (normalizedEmail !== user.email) {
        console.log(`Updating user ${user._id}: "${user.email}" -> "${normalizedEmail}"`);
        await User.findByIdAndUpdate(user._id, { email: normalizedEmail });
        userUpdates++;
      }
    }

    console.log(`Updated ${userUpdates} users`);

    // Normalize emails in PendingUser collection
    console.log('Normalizing emails in PendingUser collection...');
    const pendingUsers = await PendingUser.find({});
    let pendingUserUpdates = 0;

    for (const pendingUser of pendingUsers) {
      const normalizedEmail = normalizeEmail(pendingUser.email);
      if (normalizedEmail !== pendingUser.email) {
        console.log(`Updating pending user ${pendingUser._id}: "${pendingUser.email}" -> "${normalizedEmail}"`);
        await PendingUser.findByIdAndUpdate(pendingUser._id, { email: normalizedEmail });
        pendingUserUpdates++;
      }
    }

    console.log(`Updated ${pendingUserUpdates} pending users`);

    console.log('Email normalization complete!');
    console.log(`Total updates: ${userUpdates + pendingUserUpdates}`);

  } catch (error) {
    console.error('Error normalizing emails:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
normalizeExistingEmails(); 