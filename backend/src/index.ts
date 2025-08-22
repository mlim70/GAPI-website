// backend/src/index.ts
import path from 'path';
import 'dotenv/config';

import { logger } from './utils/logger';

logger.info('Environment loaded from:', process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env'));
logger.debug('Available environment variables:', Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('KEY') && !key.includes('PASSWORD')).join(', '));

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';

import { syncMembershipLevels } from './utils/accounts/syncStripeMemberships';
import { addSecurityHeaders } from './utils/accounts/security';
import { cleanupExpiredResetTokens } from './utils/email/userVerification';
import { getCurrentUTCISO } from './utils/dateUtils';
import { initializeTimezone, validateUTCTimezone } from './config/timezone';

// Initialize timezone configuration
initializeTimezone();



const app = express();

// Trust proxy to get correct client IP addresses (important for rate limiting behind CDNs/proxies)
app.set('trust proxy', 1);

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
import billingPortalRouter from './routes/billingPortal';

// Database initialization middleware - ensures indexes are created before any traffic
app.use(async (req, res, next) => {
  try {
    // Ensure database is connected and indexes are initialized
    await (await import('./utils/db.js')).connectToDatabase();
    next();
  } catch (error) {
    logger.error('Database initialization failed:', error);
    res.status(503).json({ 
      message: 'Service temporarily unavailable - initializing database',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
    });
  }
});

// Configure CORS with specific allowed origins
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',           // Local development
      'https://gapi-website.vercel.app', // Production Vercel
      'https://www.gapi.org',            // Production www subdomain
      'https://gapi.org'                 // Production root domain
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from:', origin);
      callback(null, false);
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};



// Database initialization middleware - ensures indexes are created before any traffic
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await (await import('./utils/db.js')).connectToDatabase();
    } catch (error) {
      logger.error('Database initialization failed:', error);
      return res.status(503).json({ 
        message: 'Service temporarily unavailable - initializing database',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
      });
    }
  }
  next();
});

// Mount webhook normally; the router applies express.raw only to POST
app.use('/api/stripe/webhook', stripeWebhookRouter);
app.use(cors(corsOptions));
app.use(addSecurityHeaders);
app.use(express.json());

// Normalize Authorization header case sensitivity
app.use((req, res, next) => {
  // Normalize Authorization header to handle case sensitivity
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    // Handle both string and string[] types, take first if array
    const normalizedHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    req.headers.authorization = normalizedHeader;
    delete req.headers.Authorization; // Remove the capitalized version
  }
  next();
});

app.use('/api/auth', router);
app.use('/api/membership-levels', membershipLevelsRouter);
app.use('/api/stripe/checkout', stripeCheckoutRouter);
app.use('/api/account', accountRouter);
app.use('/api/billing', billingPortalRouter);

app.use('/api/sponsors', sponsorsRouter);
app.use('/api/s3', s3Router);
app.use('/api/email', emailActionsRouter);

app.use('/api/newsletter', newsletterRouter);
app.use('/api/contact', contactRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  // Always return JSON response
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Export for Vercel Serverless Function
export default app;

// Only listen locally (npm run dev)
if (!process.env.VERCEL) {
  async function startServer() {
    try {
      // Validate timezone configuration
      if (!validateUTCTimezone()) {
        logger.error('Server startup failed: Timezone validation failed');
        process.exit(1);
      }
      
      // Environment variables are now validated by the env module
      
      // Initialize database connection (indexes are now handled by middleware for all requests)
      await (await import('./utils/db.js')).connectToDatabase();
      
      // Try to sync membership levels, but don't fail if it errors
      try {
        await syncMembershipLevels();
      } catch (stripeError) {
        logger.warn('Stripe sync failed, but continuing:', stripeError.message);
      }

      const PORT = process.env.PORT || 4000;
      app.listen(PORT, () => {
        logger.info('Server running on port', PORT);
        
        // Set up periodic cleanup of expired reset tokens (every hour)
        setInterval(async () => {
          try {
            await cleanupExpiredResetTokens();
          } catch (error) {
            logger.error('Failed to cleanup expired reset tokens:', error);
          }
        }, 60 * 60 * 1000); // Every hour
        
        logger.info('Reset token cleanup job scheduled');
      });
    } catch (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
  }

  startServer();
}