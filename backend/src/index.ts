// backend/src/index.ts
import 'dotenv/config';

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import User from './models/user.model.js';
import MembershipLevel from './models/membershipLevel.model.js';
import Subscription from './models/subscription.model.js';
import Order from './models/order.model.js';
import router from './routes/auth.js';
import membershipLevelsRouter from './routes/membershipLevels.js';

export async function initIndexes() {
  // model.init() returns a promise that creates all indexes declared on the schema
  await Promise.all([
    User.init(),
    MembershipLevel.init(),
    Subscription.init(),
    Order.init(),
  ]);
  console.log('✅ All Mongoose model indexes are built');
}

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', router);
app.use('/api/membership-levels', membershipLevelsRouter);

async function startServer() {
  try {
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri);
    await initIndexes(); // Checks to see if all database contents exist

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