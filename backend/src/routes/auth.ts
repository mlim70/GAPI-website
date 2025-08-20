// backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import isEmail from 'validator/lib/isEmail.js';
import User from '../models/user.model';
import MembershipLevel from '../models/membershipLevel.model';
import { JWT_SECRET } from '../config/env';

import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { normalizeEmail } from '../utils/email/emailUtils';
import { normalizeUsername } from '../utils/accounts/usernameUtils';
import { generateVerificationToken, hashVerificationToken } from '../utils/accounts/tokens';
import { sendVerificationEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders } from '../utils/accounts/security';
import { createUTCDate } from '../utils/dateUtils';

import { validateRecaptcha } from '../middleware/recaptchaValidation';
const router = Router();

/** POST /api/auth/register **/

router.post(
  '/register',
  addSecurityHeaders,
  createRateLimiter(20, 15 * 60 * 1000, 'email'), // 20 registrations per 15 minutes per email (prevent spam)
  validateRecaptcha({ action: 'registration' }),
  async (req, res) => {
    console.log('🚀 Registration endpoint called');
    console.log('📝 Request headers:', {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'user-agent': req.get('User-Agent'),
      'origin': req.get('Origin'),
      'referer': req.get('Referer')
    });
    console.log('🌐 Request details:', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      ips: req.ips,
      hostname: req.hostname
    });
    
    try {
      console.log('🔌 Connecting to database...');
      await connectToDatabase();
      console.log('✅ Database connected successfully');
      
      // Use content-type detection instead of req.file
      const isMultipart = req.is('multipart/form-data');
      console.log('📋 Request type:', isMultipart ? 'multipart/form-data' : 'application/json');
      console.log('📁 File present:', !!req.file);
      console.log('📦 Request body received:', {
        hasEmail: !!req.body.email,
        hasUsername: !!req.body.username,
        hasPassword: !!req.body.password,
        hasFirstName: !!req.body.firstName,
        hasLastName: !!req.body.lastName,
        hasLevelKey: !!req.body.levelKey,
        bodyKeys: Object.keys(req.body)
      });
      
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
      console.log('❌ Missing required fields:', { 
        email: !!email, 
        username: !!username, 
        password: !!password, 
        firstName: !!firstName, 
        lastName: !!lastName, 
        levelKey: !!levelKey 
      });
      console.log('📦 Actual body content:', req.body);
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // reCAPTCHA validation is now handled by middleware
    const recaptchaResult = res.locals.recaptchaResult;

    // 3. Check for existing User (permanent) - block registration if real user exists
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);
    
    console.log('▶️ Checking for existing user with', { 
      originalEmail: email, 
      originalUsername: username,
      normalizedEmail, 
      normalizedUsername 
    });

    // run the query using properly normalized values - only check against active users
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
      status: 'ACTIVE'  // Only check against active users
    });

    // dump what came back
    console.log('🔎 existingUser →', existingUser);
    if (existingUser) {
      console.log('❌ User already exists!', {
        existingEmail: existingUser.email,
        existingUsername: existingUser.username,
        normalizedEmail,
        normalizedUsername,
        emailMatch: existingUser.email === normalizedEmail,
        usernameMatch: existingUser.username === normalizedUsername
      });
      return res
        .status(409)
        .json({ 
          message: existingUser.email === normalizedEmail ? 'Email is already being used' : 'Username is taken'
        });
    }
    console.log('✅ No existing User found');

    // 4. verify levelKey exists
    const level = await MembershipLevel.findOne({ key: levelKey });
    console.log('Looking for levelKey:', levelKey);
    console.log('Found level:', level ? level.key : 'NOT FOUND');
    if (!level) return res.status(400).json({ message: 'Invalid levelKey' });

    // 5. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 6. Generate verification token
    console.log('🔑 Starting token generation...');
    let tokenLength = 0;
    let token: string;
    let hash: string;
    try {
      const tokenData = generateVerificationToken();
      token = tokenData.token;
      hash = tokenData.hash;
      tokenLength = token.length;
      console.log('✅ Token generated, length:', tokenLength);
    } catch (tokenError) {
      console.error('❌ Error generating token:', tokenError);
      throw tokenError;
    }

    // 7. Create real User immediately
    console.log('🆕 Creating new User with emailVerified: false');
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
      console.log('✅ New User created:', user._id);
    } catch (createError) {
      console.error('❌ Error creating new User:', createError);
      throw createError;
    }

    // 8. Send the verification email
    console.log('📧 About to send verification email...');
    console.log('📧 Email data:', {
      email: user.email,
      name: `${user.name.first} ${user.name.last}`,
      tokenLength: tokenLength,
      userId: user._id.toString()
    });
    
    try {
      await sendVerificationEmail({
        email: user.email,
        name: `${user.name.first} ${user.name.last}`,
        token: token, // Pass the raw token (not the hash)
      });
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending verification email:', emailError);
      // Don't fail the entire request if email fails
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
    console.error('❌ Registration error:', err instanceof Error ? err.message : 'Unknown error');
    console.error('❌ Full error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : 'No stack trace',
      name: err instanceof Error ? err.name : 'Unknown error type',
      code: err.code,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue
    });
    
    // Log the request data for debugging
    console.error('❌ Request data that caused error:', {
      bodyKeys: Object.keys(req.body),
      hasEmail: !!req.body.email,
      hasUsername: !!req.body.username,
      hasPassword: !!req.body.password,
      hasFirstName: !!req.body.firstName,
      hasLastName: !!req.body.lastName,
      hasLevelKey: !!req.body.levelKey,

    });
    

    
    res.status(500).json({ 
      message: 'Internal server error. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && { error: err instanceof Error ? err.message : 'Unknown error' })
    });
  }
});



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
    console.log('🔐 Login request received:', { 
      identifier: req.body.identifier ? 'Provided' : 'Missing',
      password: req.body.password ? 'Provided' : 'Missing'
    });
    
    await connectToDatabase();
  
        const { identifier, password } = req.body;
  if (!identifier || !password) {
    console.log('❌ Login failed - missing fields');
    return res.status(400).json({ message: 'Missing fields' });
  }

  // reCAPTCHA validation is now handled by middleware
  const recaptchaResult = res.locals.recaptchaResult;

  // lookup by email OR username (normalize both email and username)
  const normalizedIdentifier = isEmail(identifier) ? normalizeEmail(identifier) : normalizeUsername(identifier);
  console.log('🔍 Looking up user with normalized identifier:', normalizedIdentifier);
  
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  }).select('+passwordHash');

  if (!user) {
    console.log('❌ Login failed - user not found');
    return res.status(401).json({ message: 'Login information is incorrect. Please try again.' });
  }
  
  console.log('✅ User found:', { userId: user._id, email: user.email, username: user.username });
  
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    console.log('❌ Login failed - invalid password');
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  console.log('✅ Password verified successfully');

  // remove hash from payload
  const safeUser = user.toObject();
  delete safeUser.passwordHash;

  // Check if user account is ACTIVE (only ACTIVE users can log in)
  if (user.status !== 'ACTIVE') {
    console.log('❌ User account not active, status:', user.status);
    return res.status(403).json({ 
      message: 'Account not yet activated. Please complete your membership registration first.' 
    });
  }

  // Get user's active subscription for membership info
  const activeSubscription = await Subscription.findOne({ 
    userId: user._id, 
    status: 'ACTIVE' 
  }).populate('levelId');

  console.log('🔍 Active subscription found:', activeSubscription ? 'Yes' : 'No');

  const tokenPayload = { 
    id: user._id
  };
  
  console.log('🔑 Creating JWT token with payload:', tokenPayload);
  
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
  
  console.log('✅ JWT token created successfully');
  console.log('📤 Sending login response with token and user data');

  res.json({ token, user: safeUser });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
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
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          
          if (decoded.id) {
            console.log('🔐 Authenticated call from user:', decoded.id);
            // Apply user-scoped rate limiting for authenticated calls
            authenticatedResendLimiter(req, res, next);
            return;
          }
        } catch (jwtError) {
          console.log('❌ Invalid JWT token, treating as unauthenticated call');
        }
      }
      
      // For unauthenticated calls, continue to the main handler
      next();
    } catch (error) {
      console.error('❌ Error in rate limiting middleware:', error);
      next();
    }
  },
  async (req, res) => {
    try {
      await connectToDatabase();
      
      // Check if caller is authenticated via JWT (re-check for the main handler)
      const authHeader = req.headers.authorization;
      let isAuthenticated = false;
      let authenticatedUserId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          authenticatedUserId = decoded.id;
          isAuthenticated = true;
          console.log('🔐 Authenticated call from user:', authenticatedUserId);
        } catch (jwtError) {
          console.log('❌ Invalid JWT token, treating as unauthenticated call');
          isAuthenticated = false;
        }
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
          }
        );

        // Refresh signupIntent expiry if it's close to expiring (within 24 hours)
        if (user.signupIntent?.expiresAt && user.signupIntent.expiresAt < new Date(Date.now() + 24*60*60*1000)) {
          await User.updateOne(
            { _id: authenticatedUserId },
            { 
              $set: { 
                'signupIntent.expiresAt': new Date(Date.now() + 7*24*60*60*1000) // Extend to 7 days from now
              }
            }
          );
        }

        // Send new verification email
        await sendVerificationEmail({
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          token: token,
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
        const user = await User.findOne({ email: normalizedEmail }).select('+verificationTokenExpires');
        
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
          }
        );

        // Refresh signupIntent expiry if it's close to expiring (within 24 hours)
        if (user.signupIntent?.expiresAt && user.signupIntent.expiresAt < new Date(Date.now() + 24*60*60*1000)) {
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                'signupIntent.expiresAt': new Date(Date.now() + 7*24*60*60*1000) // Extend to 7 days from now
              }
            }
          );
        }

        // Send new verification email
        await sendVerificationEmail({
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          token: token,
        });

        // ANTI-ENUMERATION: Always return 204 to prevent information leakage
        return res.status(204).send();
      }
      
    } catch (err) {
      console.error('Error resending verification email:', err);
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
  console.log('🔍 Email verification endpoint called');
  
  try {
    const { token } = req.body;
    
    if (!token) {
      console.log('❌ Missing required field: token');
      return res.status(400).json({ message: 'Verification token is required' });
    }

    console.log('🔍 Token length:', token.length);

    // Hash the incoming token
    const hash = hashVerificationToken(token);
    
    // Find user by verificationTokenHash only
    const user = await User.findOne({
      verificationTokenHash: hash
    }).select('+verificationTokenHash +verificationTokenExpires +signupIntent');

    // Check if user exists and token is valid
    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      console.log('❌ Token validation failed:', {
        tokenHash: hash,
        currentTime: new Date(),
        reason: 'No user found with valid token or token expired'
      });
      return res.status(400).json({ 
        message: 'Verification link is invalid or has expired.',
        code: 'LINK_EXPIRED'
      });
    }

    console.log('✅ Token validated successfully for user:', user._id);

    // Update user verification status and clear tokens (single-use)
    console.log('🔄 Updating user verification status');
    user.emailVerified = true;
    user.verifiedAt = new Date();
    user.status = 'VERIFIED_PENDING_PAYMENT';  // Verified but waiting for payment
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    
    console.log('✅ User verification status updated and tokens cleared');

    // Remove sensitive data from user object
    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.verificationTokenHash;
    delete safeUser.verificationTokenExpires;
    
    console.log('✅ Email verification completed successfully');
    console.log('📋 SignupIntent data:', {
      hasSignupIntent: !!user.signupIntent,
      signupIntent: user.signupIntent,
      expiresAt: user.signupIntent?.expiresAt,
      levelKey: user.signupIntent?.levelKey,
      currentTime: new Date(),
      isExpired: user.signupIntent?.expiresAt ? user.signupIntent.expiresAt < new Date() : 'No expiresAt'
    });

    return res.json({ 
      user: safeUser,
      nextLevelKey: user.signupIntent?.expiresAt && user.signupIntent.expiresAt > new Date() 
        ? user.signupIntent.levelKey 
        : undefined,
      message: 'Email verified successfully! Please complete your membership registration to activate your account.'
    });
    
  } catch (err) {
    console.error('❌ Email verification error:', err);
    res.status(500).json({ 
      message: 'Internal server error during email verification. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: err instanceof Error ? err.message : 'Unknown error' })
    });
  }
});

export default router;
