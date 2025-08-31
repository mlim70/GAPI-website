// backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import isEmail from 'validator/lib/isEmail.js';
import User from '../models/user.model';
import MembershipLevel from '../models/membershipLevel.model';
import { JWT_SECRET } from '../config/env';
import { JwtPayload } from '../types/jwt';

import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/database/db';
import { normalizeEmail } from '../utils/email/emailUtils';
import { normalizeUsername } from '../utils/accounts/usernameUtils';
import { generateVerificationToken, hashVerificationToken } from '../utils/accounts/tokens';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders, generateVerifyNonce } from '../middleware/security';
import { createUTCDate } from '../utils/general/dateUtils';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { logger } from '../utils/general/logger';

const router = Router();

/** POST /api/auth/register **/

router.post(
  '/register',
  addSecurityHeaders,
  createRateLimiter(20, 15 * 60 * 1000, 'email'), // 20 registrations per 15 minutes per email (prevent spam)
  validateRecaptcha({ action: 'registration' }),
  async (req, res) => {
    logger.info('🚀 Registration endpoint called');
    
    try {
      await connectToDatabase();
      
      const {
        email,
        username,
        password,
        firstName,
        lastName,
        levelKey,
      } = req.body;

      // 1. basic validation
      if (!email || !username || !password || !firstName || !lastName || !levelKey) {
        logger.info('❌ Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // reCAPTCHA validation is now handled by middleware
      const recaptchaResult = res.locals.recaptchaResult;

      // 3. Check for existing User (permanent) - block registration if real user exists
      const normalizedEmail = normalizeEmail(email);
      const normalizedUsername = normalizeUsername(username);
      
      logger.info('▶️ Checking for existing user');

      // run the query using properly normalized values - only check against active users
      const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
        status: 'ACTIVE'  // Only check against active users
      });

      if (existingUser) {
        logger.info('❌ User already exists');
        return res
          .status(409)
          .json({ 
            message: existingUser.email === normalizedEmail ? 'Email is already being used' : 'Username is taken'
          });
      }
      logger.info('✅ No existing User found');

      // 4. verify levelKey exists
      const level = await MembershipLevel.findOne({ key: levelKey, status: 'ACTIVE' });
      if (!level) {
        logger.warn('❌ Invalid or archived membership level:', { levelKey });
        return res.status(400).json({ message: 'Invalid levelKey or membership level is not available' });
      }

      // 5. hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // 6. Generate verification token
      let token: string;
      let hash: string;
      try {
        const tokenData = generateVerificationToken();
        token = tokenData.token;
        hash = tokenData.hash;
      } catch (tokenError) {
        logger.error('❌ Error generating token:', tokenError);
        throw tokenError;
      }

      // 7. Create real User immediately
      let user;
      try {
        user = await User.create({
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash,
          name: { first: firstName, last: lastName },
          status: 'PENDING_VERIFICATION',  // Set initial status
          emailVerified: false,
          verificationTokenHash: hash,
          verificationTokenExpires: createUTCDate(24), // 24h from now in UTC
          signupIntent: levelKey ? { 
            levelKey, 
            createdAt: new Date(), 
            expiresAt: new Date(Date.now() + 7*24*60*60*1000) 
          } : undefined
        });
        logger.info('✅ New User created:', user._id);
      } catch (createError) {
        logger.error('❌ Error creating new User:', createError);
        throw createError;
      }

      // 8. Send the verification email
      try {
        await sendVerificationEmail({
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          token: token // Pass the raw token (not the hash)
        });
        logger.info('✅ Verification email sent to:', user.email);
      } catch (emailError) {
        logger.error('❌ Error sending verification email:', emailError);
        // Don't fail the entire request if email queuing fails
      }
      
      res.status(201).json({ 
        message: 'Check your email to verify your account.',
        userId: user._id,
        recaptcha: {
          score: recaptchaResult.score,
          action: recaptchaResult.action,
          success: recaptchaResult.success
        }
      });
    } catch (err: any) {
      logger.error('❌ Registration error:', err instanceof Error ? err.message : 'Unknown error');
      logger.error('❌ Full error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace',
        name: err instanceof Error ? err.name : 'Unknown error type',
        code: err.code,
        keyPattern: err.keyPattern,
        keyValue: err.keyValue
      });
      
      res.status(500).json({ 
        message: 'Internal server error. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { error: err instanceof Error ? err.message : 'Unknown error' })
      });
    }
  }
);



/**
 * POST /api/auth/login
 * Body: { identifier, password }
 */
router.post('/login', 
  addSecurityHeaders,
  createRateLimiter(100, 15 * 60 * 1000), // 100 login attempts per 15 minutes per IP (prevent brute force)
  validateRecaptcha({ action: 'login' }),
  async (req, res) => {
  try {
    logger.info('🔐 Login request received:', { 
      identifier: req.body.identifier ? 'Provided' : 'Missing',
      password: req.body.password ? 'Provided' : 'Missing'
    });
    
    await connectToDatabase();
  
        const { identifier, password } = req.body;
  if (!identifier || !password) {
    logger.info('❌ Login failed - missing fields');
    return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
  }

  // reCAPTCHA validation is now handled by middleware
  const recaptchaResult = res.locals.recaptchaResult;

  // lookup by email OR username (normalize both email and username)
  const normalizedIdentifier = isEmail(identifier) ? normalizeEmail(identifier) : normalizeUsername(identifier);
  logger.info('🔍 Looking up user with normalized identifier:', normalizedIdentifier);
  
  // Only allow login to ACTIVE accounts
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    status: 'ACTIVE',
  }).select('+passwordHash');

  if (!user) {
    logger.info('❌ Login failed - user not found');
    return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
  }
  
  logger.info('✅ User found:', { userId: user._id, email: user.email, username: user.username });
  
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    logger.info('❌ Login failed - invalid password');
    return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
  }
  
  logger.info('✅ Password verified successfully');

  // remove hash from payload
  const safeUser = user.toObject();
  delete safeUser.passwordHash;

  // Get user's active subscription for membership info
  const activeSubscription = await Subscription.findOne({ 
    userId: user._id, 
    status: 'ACTIVE' 
  }).populate('levelId');

  logger.info('🔍 Active subscription found:', activeSubscription ? 'Yes' : 'No');

  const tokenPayload = { 
    id: user._id
  };
  
  logger.info('🔑 Creating JWT token with payload:', tokenPayload);
  
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
  
  logger.info('✅ JWT token created successfully');
  logger.info('📤 Sending login response with token, user data, and subscription info');

  // Include subscription data in response for immediate access
  const responseData: any = { token, user: safeUser };
  
  if (activeSubscription && activeSubscription.levelId) {
    // Type assertion for populated levelId
    const populatedLevel = activeSubscription.levelId as any;
    
    responseData.subscription = {
      _id: activeSubscription._id.toString(),
      status: activeSubscription.status,
      kind: activeSubscription.kind,
      startDate: activeSubscription.startDate.toISOString(),
      nextBillDate: activeSubscription.nextBillDate?.toISOString(),
      cancelDate: activeSubscription.cancelDate?.toISOString(),
      membershipLevel: {
        _id: populatedLevel._id.toString(),
        key: populatedLevel.key,
        name: populatedLevel.key, // Use key as name since the interface doesn't have a separate name field
        description: populatedLevel.description,
        unitAmount: populatedLevel.unitAmount,
        currency: populatedLevel.currency,
        isRecurring: populatedLevel.isRecurring,
        interval: populatedLevel.interval,
        intervalCount: populatedLevel.intervalCount
      }
    };
  }

  res.json(responseData);
  } catch (err) {
    logger.error('❌ Login error:', err);
    res.status(401).json({ message: 'Invalid credentials. Please try again.' });
  }
});

/**
 * GET /api/auth/verify
 *  Checks JWT validity
 */
router.get('/verify', 
  addSecurityHeaders,
  createRateLimiter(100, 15 * 60 * 1000), // 100 verifications per 15 minutes per IP
  (req, res) => {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!auth) {
    return res.status(401).json({ message: 'Missing token' });
  }
  try {
    jwt.verify(auth, JWT_SECRET);
    return res.status(200).json({ valid: true });
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
});



/**
 * POST /api/auth/resend-verification
 * Resends verification email for a user
 * Supports both authenticated (JWT) and unauthenticated (email-based) calls
 */
// Create user-scoped rate limiter for authenticated resends
const authenticatedResendLimiter = createRateLimiter(5, 10 * 60 * 1000, 'user'); // 5 requests per 10 minutes per user

router.post('/resend-verification',
  addSecurityHeaders,
  // Rate limiting: per IP for unauthenticated, per userId for authenticated
  createRateLimiter(10, 15 * 60 * 1000, 'ip'), // 10 requests per 15 minutes per IP
  validateRecaptcha({ action: 'resend_verification', required: false }), // Only required for unauthenticated calls
  async (req, res, next) => {
    try {
      // Check if caller is authenticated via JWT
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
          
          if (decoded.id) {
            logger.info('🔐 Authenticated call from user:', decoded.id);
            // Store decoded JWT in res.locals
            res.locals.authenticatedUser = decoded;
            // Apply user-scoped rate limiting for authenticated calls
            authenticatedResendLimiter(req, res, next);
            return;
          }
        } catch (jwtError) {
          logger.info('❌ Invalid JWT token, treating as unauthenticated call');
        }
      }
      
      // For unauthenticated calls, continue to the main handler
      next();
    } catch (error) {
      logger.error('❌ Error in rate limiting middleware:', error);
      next();
    }
  },
  async (req, res) => {
    try {
      await connectToDatabase();
      
      // Check if caller is authenticated via JWT (reuse decoded payload from middleware)
      let isAuthenticated = false;
      let authenticatedUserId = null;
      
      if (res.locals.authenticatedUser) {
        authenticatedUserId = res.locals.authenticatedUser.id;
        isAuthenticated = true;
        logger.info('🔐 Authenticated call from user:', authenticatedUserId);
      }

      if (isAuthenticated) {
        // AUTHENTICATED CALL: Look up by userId only (from JWT token)
        // Ignore any email the client sends to prevent targeting other accounts
        
        if (!authenticatedUserId) {
          return res.status(400).json({ message: 'Invalid request' });
        }

        // Find user by authenticated userId
        const user = await User.findById(authenticatedUserId).select('+verificationTokenExpires');
        
        // Always return 204 to prevent information leakage
        if (!user) {
          return res.status(204).send();
        }

        // Check if email is already verified
        if (user.emailVerified) {
          return res.status(204).send();
        }

        // Always rotate token (remove expired check)
        const { token, hash } = generateVerificationToken();
        await User.updateOne(
          { _id: authenticatedUserId },
          { 
            $set: { 
              verificationTokenHash: hash,
              verificationTokenExpires: createUTCDate(24) // 24h from now in UTC
            }
          },
          { runValidators: true }
        );

        // Refresh signupIntent expiry if it's close to expiring (within 24 hours)
        if (user.signupIntent?.expiresAt && user.signupIntent.expiresAt < new Date(Date.now() + 24*60*60*1000)) {
          await User.updateOne(
            { _id: authenticatedUserId },
            { 
              $set: { 
                'signupIntent.expiresAt': new Date(Date.now() + 7*24*60*60*1000) // Extend to 7 days from now
              }
            },
            { runValidators: true }
          );
        }

        // Send new verification email
        await sendVerificationEmail({
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          token: token
        });

        // Always return 204 to prevent information leakage
        return res.status(204).send();

      } else {
        // UNAUTHENTICATED CALL: Look up by email only with anti-enumeration
        
        const { email } = req.body;
        
        if (!email) {
          return res.status(400).json({ message: 'Email is required' });
        }

        // reCAPTCHA validation is now handled by middleware
        const recaptchaResult = res.locals.recaptchaResult;

        // Normalize email with existing helper for consistency
        const normalizedEmail = normalizeEmail(email);
        
        // Find user by email
        const user = await User.findOne({
          email: normalizedEmail,
          status: { $in: ['PENDING_VERIFICATION', 'VERIFIED_PENDING_PAYMENT'] },
        }).sort({ createdAt: -1 }).select('+verificationTokenExpires');
        
        // ANTI-ENUMERATION: Always return 204 regardless of whether user exists
        // This prevents attackers from determining which emails are registered
        if (!user) {
          return res.status(204).send();
        }

        // Check if email is already verified
        if (user.emailVerified) {
          return res.status(204).send();
        }

        // Always rotate token if user exists & is unverified (remove expired check)
        const { token, hash } = generateVerificationToken();
        await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              verificationTokenHash: hash,
              verificationTokenExpires: createUTCDate(24) // 24h from now in UTC
            }
          },
          { runValidators: true }
        );

        // Refresh signupIntent expiry if it's close to expiring (within 24 hours)
        if (user.signupIntent?.expiresAt && user.signupIntent.expiresAt < new Date(Date.now() + 24*60*60*1000)) {
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                'signupIntent.expiresAt': new Date(Date.now() + 7*24*60*60*1000) // Extend to 7 days from now
              }
            },
            { runValidators: true }
          );
        }

        // Send new verification email
        await sendVerificationEmail({
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          token: token
        });

        // ANTI-ENUMERATION: Always return 204 to prevent information leakage
        return res.status(204).send();
      }
      
    } catch (err) {
      logger.error('Error resending verification email:', err);
      // Even on error, return 204 to prevent information leakage
      res.status(204).send();
    }
  }
);

/**
 * POST /api/auth/verify-email
 * Verifies user email using token from verification email
 */
router.post('/verify-email', async (req, res) => {
  logger.info('🔍 Email verification endpoint called');
  
  try {
    await connectToDatabase();
    
    const { token } = req.body;
    
    if (!token) {
      logger.info('❌ Missing required field: token');
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Hash the incoming token
    const hash = hashVerificationToken(token);
    
    // Find user by verificationTokenHash only
    const user = await User.findOne({
      verificationTokenHash: hash
    }).select('+verificationTokenHash +verificationTokenExpires +signupIntent');

    // Check if user exists and token is valid
    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      logger.info('❌ Token validation failed');
      return res.status(400).json({ 
        message: 'Verification link is invalid or has expired.',
        code: 'LINK_EXPIRED'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      logger.info('✅ User already verified, returning success:', user._id);
      
      // Return success with next step information
      const hasValidSignupIntent = user.signupIntent?.expiresAt && user.signupIntent.expiresAt > new Date();
      
      return res.json({
        alreadyVerified: true,
        message: 'Email already verified successfully!',
        next: hasValidSignupIntent ? '/stripe/checkout/start' : undefined,
        nextLevelKey: hasValidSignupIntent ? user.signupIntent.levelKey : undefined
      });
    }

    logger.info('✅ Token validated successfully for user:', user._id);

    // Update user verification status and clear tokens (single-use)
    user.emailVerified = true;
    user.verifiedAt = new Date();
    user.status = 'VERIFIED_PENDING_PAYMENT';  // Verified but waiting for payment
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    
    logger.info('✅ User verification status updated and tokens cleared');

    // Remove sensitive data from user object
    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.verificationTokenHash;
    delete safeUser.verificationTokenExpires;
    
    logger.info('✅ Email verification completed successfully');

    // Return success with next step information
    const hasValidSignupIntent = user.signupIntent?.expiresAt && user.signupIntent.expiresAt > new Date();
    
    return res.json({ 
      user: safeUser,
      message: 'Email verified successfully! Please complete your membership registration to activate your account.',
      next: hasValidSignupIntent ? '/stripe/checkout/start' : undefined,
      nextLevelKey: hasValidSignupIntent ? user.signupIntent.levelKey : undefined
    });
    
  } catch (err) {
    logger.error('❌ Email verification error:', err);
    res.status(500).json({ 
      message: 'Internal server error during email verification. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: err instanceof Error ? err.message : 'Unknown error' })
    });
  }
});


export default router;
