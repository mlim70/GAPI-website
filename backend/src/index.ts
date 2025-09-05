// backend/src/index.ts
import path from 'path';
import 'dotenv/config';

import { logger } from './utils/general/logger';

logger.info('Environment loaded from:', process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env'));

import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';

import { syncMembershipLevels } from './utils/accounts/syncStripeMemberships';
import { addSecurityHeaders } from './middleware/security';
import { cleanupExpiredResetTokens } from './utils/email/userVerification';
import { initializeTimezone } from './config/timezone';

// Import all routes from organized index
import {
  authRouter,
  membershipLevelsRouter,
  stripeCheckoutRouter,
  stripeWebhookRouter,
  accountRouter,
  sponsorsRouter,
  s3Router,
  emailActionsRouter,
  emailTestRouter,
  newsletterRouter,
  newsletterReaderRouter,
  contactRouter,
  billingPortalRouter
} from './routes';

// Initialize timezone configuration
initializeTimezone();

const app = express();

// Trust proxy configuration for Vercel deployment
// Use Vercel's specific setup
if (process.env.VERCEL) {
  // Vercel deployment: trust Vercel's proxy setup
  app.set('trust proxy', true);
} else {
  // Local development: trust first proxy only
  app.set('trust proxy', 'loopback');
}

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
      await (await import('./utils/database/db.js')).connectToDatabase();
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

// Health check endpoint - add this before other routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

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

app.use('/api/auth', authRouter);
app.use('/api/membership-levels', membershipLevelsRouter);
app.use('/api/stripe/checkout', stripeCheckoutRouter);
app.use('/api/account', accountRouter);
app.use('/api/billing', billingPortalRouter);

app.use('/api/sponsors', sponsorsRouter);
app.use('/api/s3', s3Router);
app.use('/api/email', emailActionsRouter);
app.use('/api/email-test', emailTestRouter);

app.use('/api/newsletter', newsletterRouter);
app.use('/api/newsletter/reader', newsletterReaderRouter);
app.use('/api/contact', contactRouter);

// Cache monitoring routes removed - not needed for production

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
      // Initialize database connection
      await (await import('./utils/database/db.js')).connectToDatabase();
      
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
        }, 60 * 60 * 1000);
        
        logger.info('Reset token cleanup job scheduled');
      });
    } catch (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
  }

  startServer();
}