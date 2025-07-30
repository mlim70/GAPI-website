// backend/scripts/normalizeUsernames.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model';
import PendingUser from '../src/models/pendingUser.model';
import { normalizeUsername } from '../src/utils/usernameUtils';

async function normalizeExistingUsernames() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Normalize usernames in User collection
    console.log('Normalizing usernames in User collection...');
    const users = await User.find({});
    let userUpdates = 0;

    for (const user of users) {
      const normalizedUsername = normalizeUsername(user.username);
      if (normalizedUsername !== user.username) {
        console.log(`Updating user ${user._id}: "${user.username}" -> "${normalizedUsername}"`);
        await User.findByIdAndUpdate(user._id, { username: normalizedUsername });
        userUpdates++;
      }
    }

    console.log(`Updated ${userUpdates} users`);

    // Normalize usernames in PendingUser collection
    console.log('Normalizing usernames in PendingUser collection...');
    const pendingUsers = await PendingUser.find({});
    let pendingUserUpdates = 0;

    for (const pendingUser of pendingUsers) {
      const normalizedUsername = normalizeUsername(pendingUser.username);
      if (normalizedUsername !== pendingUser.username) {
        console.log(`Updating pending user ${pendingUser._id}: "${pendingUser.username}" -> "${normalizedUsername}"`);
        await PendingUser.findByIdAndUpdate(pendingUser._id, { username: normalizedUsername });
        pendingUserUpdates++;
      }
    }

    console.log(`Updated ${pendingUserUpdates} pending users`);

    console.log('Username normalization complete!');
    console.log(`Total updates: ${userUpdates + pendingUserUpdates}`);

  } catch (error) {
    console.error('Error normalizing usernames:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  normalizeExistingUsernames();
}

export default normalizeExistingUsernames; 