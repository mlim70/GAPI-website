// backend/src/index.ts
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import mongoose from 'mongoose';
import express from 'express';
import User from './models/user.model.js';
import MembershipLevel from './models/membershipLevel.model.js';
import Subscription from './models/subscription.model.js';
import Payment from './models/payment.model.js';

export async function initIndexes() {
  // model.init() returns a promise that creates all indexes declared on the schema
  await Promise.all([
    User.init(),
    MembershipLevel.init(),
    Subscription.init(),
    Payment.init(),
  ]);
  console.log('✅ All Mongoose model indexes are built');
}

const app = express();
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri);
    await initIndexes(); // Ensures all indexes/collections are created

    app.get('/api/health', (req, res) => res.send('API is running!'));

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();