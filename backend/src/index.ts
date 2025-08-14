// backend/src/index.ts
import path from 'path';
import 'dotenv/config';

console.log('🔧 Environment loaded from:', process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env'));
console.log('🔧 Available environment variables:', Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('KEY') && !key.includes('PASSWORD')).join(', '));

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import User from './models/user.model';
import PendingUser from './models/pendingUser.model';
import CheckoutSession from './models/checkoutSession.model';
import WebhookEvent from './models/webhookEvent.model';
import MembershipLevel from './models/membershipLevel.model';
import Subscription from './models/subscription.model';
import Order from './models/order.model';

import { syncMembershipLevels } from './utils/accounts/syncStripeMemberships';
import { addSecurityHeaders } from './utils/accounts/security';
import { cleanupExpiredResetTokens } from './utils/email/userVerification';
import { getCurrentUTCISO } from './utils/dateUtils';
import { initializeTimezone, validateUTCTimezone } from './config/timezone';

// Initialize timezone configuration
initializeTimezone();

export async function initIndexes() {
  console.log('🔧 Initializing database indexes...');
  
  try {
    // Initialize all models except PendingUser, CheckoutSession, and WebhookEvent (which have special TTL index handling)
    await Promise.all([
      User.init(),
      MembershipLevel.init(),
      Subscription.init(),
      Order.init(),
    ]);
    console.log('✅ Basic indexes initialized');

    // Create TTL index for User resetTokenExpires (1 hour)
    try {
      await User.collection.createIndex(
        { resetTokenExpires: 1 }, 
        { 
          expireAfterSeconds: 0, // Documents expire when resetTokenExpires is reached
          name: 'resetTokenExpires_ttl_1'
        }
      );
      console.log('✅ User resetTokenExpires TTL index created');
         } catch (error: any) {
       if (error.code === 85) { // IndexOptionsConflict
         console.log('ℹ️ User resetTokenExpires TTL index already exists with different options - this is okay');
       } else {
         console.log('⚠️ Error creating User resetTokenExpires TTL index:', error.message);
       }
     }

    // Initialize PendingUser with all indexes manually (including TTL)
    await PendingUser.init();
    console.log('✅ PendingUser basic indexes initialized');

    // Create additional indexes that would normally be auto-created
    try {
      // Case-insensitive username index
      await PendingUser.collection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          collation: { locale: 'en', strength: 2 },
          name: 'username_case_insensitive_1'
        }
      );
      console.log('✅ PendingUser username case-insensitive index created');
    } catch (error: any) {
      if (error.code === 85) { // IndexOptionsConflict
        console.log('ℹ️ Username index already exists with different options - this is okay');
      } else {
        console.log('⚠️ Error creating username index:', error.message);
      }
    }

    // Now create the TTL indexes manually
    try {
      // Primary TTL index on expiresAt
      await PendingUser.collection.createIndex(
        { expiresAt: 1 }, 
        { 
          expireAfterSeconds: 0,
          name: 'expiresAt_ttl_1'
        }
      );
      console.log('✅ PendingUser expiresAt TTL index created');

      // Secondary TTL index on emailVerificationTokenExpires
      await PendingUser.collection.createIndex(
        { emailVerificationTokenExpires: 1 }, 
        { 
          expireAfterSeconds: 0,
          name: 'emailVerificationTokenExpires_ttl_1'
        }
      );
      console.log('✅ PendingUser emailVerificationTokenExpires TTL index created');
         } catch (error: any) {
       if (error.code === 85) { // IndexOptionsConflict
         console.log('ℹ️ TTL index already exists with different options - this is okay');
       } else {
         console.log('⚠️ Error creating TTL indexes:', error.message);
       }
     }

    // Initialize CheckoutSession with all indexes manually (including TTL)
    await CheckoutSession.init();
    console.log('✅ CheckoutSession basic indexes initialized');

    // Create additional indexes that would normally be auto-created
    try {
      // Stripe session ID unique index
      await CheckoutSession.collection.createIndex(
        { stripeSessionId: 1 }, 
        { 
          unique: true,
          sparse: true, // Allow null values
          name: 'stripeSessionId_unique_1'
        }
      );
      console.log('✅ CheckoutSession stripeSessionId unique index created');
    } catch (error: any) {
      if (error.code === 85) { // IndexOptionsConflict
        console.log('ℹ️ Stripe session ID index already exists with different options - this is okay');
      } else {
        console.log('⚠️ Error creating stripe session ID index:', error.message);
      }
    }

    // Create TTL index for CheckoutSession (24 hours)
    try {
      await CheckoutSession.collection.createIndex(
        { expiresAt: 1 }, 
        { 
          expireAfterSeconds: 86400, // 24 hours
          name: 'expiresAt_ttl_24h_1'
        }
      );
      console.log('✅ CheckoutSession TTL index created');
         } catch (error: any) {
       if (error.code === 85) { // IndexOptionsConflict
         console.log('ℹ️ CheckoutSession TTL index already exists with different options - this is okay');
       } else {
         console.log('⚠️ Error creating CheckoutSession TTL index:', error.message);
       }
     }

    // Initialize WebhookEvent with all indexes manually (including TTL)
    await WebhookEvent.init();
    console.log('✅ WebhookEvent basic indexes initialized');

    // Create additional indexes that would normally be auto-created
    try {
      // Event ID unique index
      await WebhookEvent.collection.createIndex(
        { eventId: 1 }, 
        { 
          unique: true,
          name: 'eventId_unique_1'
        }
      );
      console.log('✅ WebhookEvent eventId unique index created');

      // Event type index
      await WebhookEvent.collection.createIndex(
        { eventType: 1 }, 
        { 
          name: 'eventType_1'
        }
      );
      console.log('✅ WebhookEvent eventType index created');
    } catch (error: any) {
      if (error.code === 85) { // IndexOptionsConflict
        console.log('ℹ️ WebhookEvent indexes already exist with different options - this is okay');
      } else {
        console.log('⚠️ Error creating WebhookEvent indexes:', error.message);
      }
    }

    // Create TTL index for WebhookEvent (90 days)
    try {
      await WebhookEvent.collection.createIndex(
        { processedAt: 1 }, 
        { 
          expireAfterSeconds: 7776000, // 90 days
          name: 'processedAt_ttl_90d_1'
        }
      );
      console.log('✅ WebhookEvent TTL index created');
         } catch (error: any) {
       if (error.code === 85) { // IndexOptionsConflict
         console.log('ℹ️ WebhookEvent TTL index already exists with different options - this is okay');
       } else {
         console.log('⚠️ Error creating WebhookEvent TTL index:', error.message);
       }
     }
    
    console.log('✅ All indexes initialized successfully');
  } catch (error: any) {
    console.error('❌ Error initializing indexes:', error.message);
    if (error.code === 85) {
      console.log('💡 IndexOptionsConflict detected. This usually means TTL indexes already exist with different options.');
      console.log('💡 The server should still work, but you may want to manually clean up conflicting indexes.');
    } else {
      console.log('💡 Unknown index error. Check MongoDB connection and permissions.');
    }
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Add security headers to all routes
app.use(addSecurityHeaders);

// Import routes
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

// 1) First mount the webhook route with raw-body parser
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
      environment: process.env.NODE_ENV || 'development',
      hasRecaptchaSecret: Boolean(process.env.RECAPTCHA_SECRET_KEY),
      hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY)
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