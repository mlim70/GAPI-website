// backend/src/index.ts
import 'dotenv/config';

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '@models/user.model.js';
import PendingUser from '@models/pendingUser.model.js';
import MembershipLevel from '@models/membershipLevel.model.js';
import Subscription from '@models/subscription.model.js';
import Order from '@models/order.model.js';
import router from '@routes/auth.js';
import membershipLevelsRouter from '@routes/membershipLevels.js';
import stripeCheckoutRouter from '@routes/stripeCheckout.js';
import stripeWebhookRouter from '@routes/stripeWebhook.js';
import accountRouter from '@routes/account.js';
import { syncMembershipLevels } from '@utils/syncStripeMemberships.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initIndexes() {
  // model.init() returns a promise that creates all indexes declared on the schema
  await Promise.all([
    User.init(),
    MembershipLevel.init(),
    Subscription.init(),
    Order.init(),
  ]);

  // Create TTL index for PendingUser separately to avoid conflicts
  try {
    await PendingUser.collection.createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 }
    );
    console.log('✅ PendingUser TTL index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️  PendingUser TTL index already exists with different options');
    } else {
      console.error('❌ Error creating PendingUser TTL index:', error.message);
    }
  }

  await PendingUser.init();
  console.log('✅ All Mongoose model indexes are built');
}

const app = express();
const PORT = 4000;

app.use(cors());

// Webhook route needs raw body for signature verification
app.use('/api/stripe/webhook', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json());
app.use('/api/auth', router);
app.use('/api/membership-levels', membershipLevelsRouter);
app.use('/api/stripe/checkout', stripeCheckoutRouter);
app.use('/api/account', accountRouter);

async function startServer() {
  try {
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri);
    await initIndexes(); // Checks to see if all database contents exist
    await syncMembershipLevels(); // Sync membership levels from Stripe

    app.get('/api/health', (req, res) => res.send('API is running!'));

    // Serve static files from the React app build directory
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));

    // Catch-all handler: send back React's index.html file for any non-API routes
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();