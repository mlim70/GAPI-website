// backend/src/index.ts
import 'dotenv/config';

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import User from './models/user.model';
import PendingUser from './models/pendingUser.model';
import MembershipLevel from './models/membershipLevel.model';
import Subscription from './models/subscription.model';
import Order from './models/order.model';
import router from './routes/auth';
import membershipLevelsRouter from './routes/membershipLevels';
import stripeCheckoutRouter from './routes/stripeCheckout';
import stripeWebhookRouter from './routes/stripeWebhook';
import accountRouter from './routes/account';

import sponsorsRouter from './routes/sponsors';
import s3Router from './routes/s3';
import emailActionsRouter from './routes/emailActions';
import newsletterRouter from './routes/newsletter';
import contactRouter from './routes/contact';

import { syncMembershipLevels } from './utils/accounts/syncStripeMemberships';
import { addSecurityHeaders } from './utils/accounts/security';
import { cleanupExpiredResetTokens } from './utils/email/userVerification';
import { getCurrentUTCISO } from './utils/dateUtils';
import { initializeTimezone, validateUTCTimezone } from './config/timezone';

// Initialize timezone configuration early
initializeTimezone();

export async function initIndexes() {
  console.log('🔧 Initializing database indexes...');
  
  try {
    // Initialize all models except PendingUser (which has special TTL index handling)
    await Promise.all([
      User.init(),
      MembershipLevel.init(),
      Subscription.init(),
      Order.init(),
    ]);
    console.log('✅ Basic indexes initialized');

    // Handle PendingUser TTL index separately to avoid conflicts
    try {
      // First, try to drop any existing expiresAt index
      await PendingUser.collection.dropIndex('expiresAt_1');
      console.log('✅ Dropped existing expiresAt index');
    } catch (error: any) {
      if (error.code === 26) { // IndexNotFound
        console.log('ℹ️ ExpiresAt index not found, skipping drop');
      } else if (error.code === 86) { // IndexKeySpecsConflict
        console.log('⚠️ Index conflict detected, attempting to resolve...');
        // Try to drop and recreate the index
        try {
          await PendingUser.collection.dropIndex('expiresAt_1');
          console.log('✅ Successfully dropped conflicting index');
        } catch (dropError: any) {
          console.log('⚠️ Could not drop conflicting index:', dropError.message);
        }
      } else {
        console.log('⚠️ Error dropping expiresAt index:', error.message);
      }
    }

    // Initialize PendingUser without TTL index
    await PendingUser.init();
    console.log('✅ PendingUser basic indexes initialized');

    // Now create the TTL index manually
    try {
      await PendingUser.collection.createIndex(
        { expiresAt: 1 }, 
        { 
          expireAfterSeconds: 0,
          name: 'expiresAt_ttl_1'
        }
      );
      console.log('✅ PendingUser TTL index created');
    } catch (error: any) {
      if (error.code === 85) { // IndexOptionsConflict
        console.log('ℹ️ TTL index already exists with different options - this is okay');
      } else if (error.code === 86) { // IndexKeySpecsConflict
        console.log('⚠️ TTL index conflict detected, trying alternative name...');
        try {
          await PendingUser.collection.createIndex(
            { expiresAt: 1 }, 
            { 
              expireAfterSeconds: 0,
              name: 'expiresAt_ttl_alt_1'
            }
          );
          console.log('✅ PendingUser TTL index created with alternative name');
        } catch (altError: any) {
          console.log('⚠️ Could not create TTL index with alternative name:', altError.message);
        }
      } else {
        console.error('❌ Error creating TTL index:', error.message);
      }
    }
    
    console.log('✅ All indexes initialized successfully');
  } catch (error: any) {
    console.error('❌ Error initializing indexes:', error.message);
    if (error.code === 86) {
      console.log('💡 Index conflict detected. Run "npm run fix-indexes" to resolve conflicts.');
    }
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Add security headers to all routes
app.use(addSecurityHeaders);

// 1) First mount the webhook route with raw-body parser
//    (this must happen before any express.json() or express.urlencoded())
app.use(
  '/api/stripe/webhook',
  bodyParser.raw({ type: 'application/json' }),
  stripeWebhookRouter
);

// 2) Then for everything else, use your normal JSON body-parser
app.use(express.json());
app.use('/api/auth', router);
app.use('/api/membership-levels', membershipLevelsRouter);
app.use('/api/stripe/checkout', stripeCheckoutRouter);
app.use('/api/account', accountRouter);

app.use('/api/sponsors', sponsorsRouter);
app.use('/api/s3', s3Router);
app.use('/api/email', emailActionsRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/contact', contactRouter);


// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      timestamp: getCurrentUTCISO(),
      database: dbStatus,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: getCurrentUTCISO(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware - must be after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Always return JSON response
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler - must be after error handling middleware
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Export app for testing
export default app;



async function startServer() {
  try {
    // Validate timezone configuration
    if (!validateUTCTimezone()) {
      console.error('❌ Server startup failed: Timezone validation failed');
      process.exit(1);
    }
    
    // Check for required environment variables
    const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'STRIPE_SECRET_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
      process.exit(1);
    }
    
    // Initialize database connection and indexes for startup tasks
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri);
    await initIndexes();
    
    // Try to sync membership levels, but don't fail if it errors
    try {
      await syncMembershipLevels();
    } catch (stripeError) {
      console.error('Stripe sync failed, but continuing:', stripeError.message);
    }

    // Only start the server if not on Vercel (Vercel handles the serverless functions)
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        
        // Set up periodic cleanup of expired reset tokens (every hour)
        setInterval(async () => {
          try {
            await cleanupExpiredResetTokens();
          } catch (error) {
            console.error('Failed to cleanup expired reset tokens:', error);
          }
        }, 60 * 60 * 1000); // Every hour
        
        console.log('🧹 Reset token cleanup job scheduled');
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();