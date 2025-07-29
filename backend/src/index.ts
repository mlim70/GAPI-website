// backend/src/index.ts
import 'dotenv/config';

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '@models/user.model';
import PendingUser from '@models/pendingUser.model';
import MembershipLevel from '@models/membershipLevel.model';
import Subscription from '@models/subscription.model';
import Order from '@models/order.model';
import router from '@routes/auth';
import membershipLevelsRouter from '@routes/membershipLevels';
import stripeCheckoutRouter from '@routes/stripeCheckout';
import stripeWebhookRouter from '@routes/stripeWebhook';
import accountRouter from '@routes/account';
import { syncMembershipLevels } from '@utils/syncStripeMemberships';

// CommonJS equivalent - no need for __filename/__dirname in this context

export async function initIndexes() {
  // model.init() returns a promise that creates all indexes declared on the schema
  await Promise.all([
    User.init(),
    MembershipLevel.init(),
    Subscription.init(),
    Order.init(),
  ]);

  // Handle PendingUser TTL index separately to avoid conflicts
  try {
    // First, try to drop any existing expiresAt index
    await PendingUser.collection.dropIndex('expiresAt_1');
    console.log('✅ Dropped existing expiresAt index');
  } catch (error: any) {
    if (error.code === 26) { // IndexNotFound
      console.log('ℹ️  No existing expiresAt index to drop');
    } else {
      console.log('ℹ️  Could not drop existing index:', error.message);
    }
  }

  // Initialize PendingUser without TTL index
  await PendingUser.init();

  // Now create the TTL index manually
  try {
    await PendingUser.collection.createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 }
    );
    console.log('✅ PendingUser TTL index created successfully');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️  TTL index already exists with different options - this is okay');
    } else {
      console.error('❌ Error creating TTL index:', error.message);
    }
  }

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

// Export app for testing
export default app;



async function startServer() {
  try {
    // Check for required environment variables
    const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'STRIPE_SECRET_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars);
      process.exit(1);
    }
    
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