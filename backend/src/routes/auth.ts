import express, { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import isEmail from 'validator/lib/isEmail.js';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import MembershipLevel from '../models/membershipLevel.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { normalizeEmail } from '../utils/email/emailUtils';
import { normalizeUsername } from '../utils/accounts/usernameUtils';
import { generateVerificationToken } from '../utils/accounts/tokens';
import { sendVerificationEmail } from '../utils/email/email';
import { findAndHandleExpiredPendingUser } from '../utils/accounts/pendingUserUtils';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders, sanitizeError } from '../utils/accounts/security';
import { getCurrentUTCISO, createUTCDate } from '../utils/dateUtils';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';


// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const router = Router();

/** POST /api/auth/pending-user **/ 

// Debug endpoint to test basic functionality
router.get('/debug', 
  addSecurityHeaders,
  createRateLimiter(20, 15 * 60 * 1000), // 20 debug calls per 15 minutes per IP
  async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called');
    
    // Test database connection
    console.log('🔍 Testing database connection...');
    await connectToDatabase();
    console.log('✅ Database connection successful');
    
    // Test environment variables
    console.log('🔍 Checking environment variables...');
    const envVars = {
      MONGODB_URI: !!process.env.MONGODB_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      MAILGUN_API_KEY: !!process.env.MAILGUN_API_KEY,
      MAILGUN_DOMAIN: !!process.env.MAILGUN_DOMAIN,
      CLIENT_URL: process.env.CLIENT_URL || 'Not set'
    };
    console.log('✅ Environment variables:', envVars);
    
    // Test model imports
    console.log('🔍 Testing model imports...');
    console.log('✅ User model:', !!User);
    console.log('✅ PendingUser model:', !!PendingUser);
    console.log('✅ CheckoutSession model:', !!CheckoutSession);
    console.log('✅ MembershipLevel model:', !!MembershipLevel);
    
    // Test utility functions
    console.log('🔍 Testing utility functions...');
    console.log('✅ normalizeEmail function:', !!normalizeEmail);
    console.log('✅ normalizeUsername function:', !!normalizeUsername);
    console.log('✅ findAndHandleExpiredPendingUser function:', !!findAndHandleExpiredPendingUser);
    
    res.json({ 
      status: 'success', 
      message: 'Debug endpoint working',
      envVars,
      timestamp: getCurrentUTCISO()
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
});

router.post(
  '/pending-user',
  express.json(),
  addSecurityHeaders,
  createRateLimiter(20, 15 * 60 * 1000, 'email'), // 20 registrations per 15 minutes per email (prevent spam)
  async (req, res) => {
    console.log('🚀 Pending-user endpoint called');
    console.log('📝 Request headers:', {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length')
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
      console.log('Missing required fields:', { email, username, password: !!password, firstName, lastName, levelKey });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 2. reCAPTCHA verification
    const { recaptchaToken } = req.body;
    if (!recaptchaToken) {
      console.log('❌ Missing reCAPTCHA token');
      return res.status(400).json({ message: 'Security verification required. Please refresh the page and try again.' });
    }

    console.log('🔍 Verifying reCAPTCHA token...');
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
    
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
      return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
    }

    // Check if score is acceptable for registration (higher threshold for sensitive actions)
    const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'registration', 0.6);
    if (!isScoreAcceptable) {
      console.log('❌ reCAPTCHA score too low:', recaptchaResult.score);
      return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
    }

    console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);

    // 3. Check for existing User (permanent) - block registration if real user exists
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);
    
    console.log('▶️ Checking for existing user with', { 
      originalEmail: email, 
      originalUsername: username,
      normalizedEmail, 
      normalizedUsername 
    });

    // run the query using properly normalized values
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
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

    // 4. Check for existing PendingUser - update if valid, clean up if expired
    console.log('🔍 Checking for existing PendingUser with:', { normalizedEmail, normalizedUsername });
    const pendingUserResult = await findAndHandleExpiredPendingUser(normalizedEmail, normalizedUsername);
    
    let existingPendingUser = null;
    
    if (pendingUserResult.found) {
      console.log(`🔍 Found existing PendingUser for ${email}:`, {
        id: pendingUserResult.pendingUser._id,
        expiresAt: pendingUserResult.expirationInfo.expiresAt,
        now: pendingUserResult.expirationInfo.now,
        isExpired: pendingUserResult.expirationInfo.isExpired,
        timeUntilExpiry: pendingUserResult.expirationInfo.timeUntilExpiry
      });
      
      if (pendingUserResult.expirationInfo.isExpired) {
        console.log(`🗑️ PendingUser has expired, cleaned up and allowing re-registration`);
        console.log(`🗑️ Cleaned up ${pendingUserResult.expirationInfo.deletedCheckoutSessions} related CheckoutSession records`);
      } else {
        console.log(`⏳ PendingUser is still valid, updating existing record`);
        existingPendingUser = pendingUserResult.pendingUser;
      }
    }

    // 5. verify levelKey exists
    const level = await MembershipLevel.findOne({ key: levelKey });
    console.log('Looking for levelKey:', levelKey);
    console.log('Found level:', level ? level.key : 'NOT FOUND');
    if (!level) return res.status(400).json({ message: 'Invalid levelKey' });

    // 6. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 7. Create or update PendingUser
    console.log('🔄 Starting PendingUser creation/update...');
    let pending;
    
    if (existingPendingUser) {
      console.log('🔄 Updating existing PendingUser:', existingPendingUser._id);
      console.log('📝 Updating with latest form data:', {
        email: normalizedEmail,
        username: normalizedUsername,
        firstName,
        lastName,
        levelKey
      });
      
      try {
        // Update existing pending user with latest form data (not original data)
        pending = await PendingUser.findByIdAndUpdate(
          existingPendingUser._id,
          {
            passwordHash, // Latest password
            name: { first: firstName, last: lastName }, // Latest name
            levelKey, // Latest membership level
            expiresAt: createUTCDate(24), // Reset expiration - 24 hours from now in UTC
            emailVerified: false, // Reset email verification status
            emailVerificationTokenHash: undefined, // Clear old token
            emailVerificationTokenExpires: undefined // Clear old token expiry
          },
          { new: true }
        );
        console.log('✅ Updated existing PendingUser with latest data:', pending._id);
      } catch (updateError) {
        console.error('❌ Error updating existing PendingUser:', updateError);
        throw updateError;
      }
    } else {
      console.log('🆕 Creating new PendingUser with data:', { 
        originalEmail: email, 
        normalizedEmail, 
        originalUsername: username, 
        normalizedUsername, 
        levelKey 
      });
      
      try {
        pending = await PendingUser.create({
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash,
          name: { first: firstName, last: lastName },
          levelKey,
        });
        console.log('✅ Created new PendingUser:', pending._id);
      } catch (createError) {
        console.error('❌ Error creating new PendingUser:', createError);
        throw createError;
      }
    }

    // 8. Create or update CheckoutSession
    console.log('🔄 Starting CheckoutSession creation/update...');
    let checkout;
    
    try {
      const existingCheckout = await CheckoutSession.findOne({ pendingUserId: pending._id });
      
      if (existingCheckout) {
        console.log('🔄 Updating existing CheckoutSession:', existingCheckout._id);
        checkout = await CheckoutSession.findByIdAndUpdate(
          existingCheckout._id,
          {
            pendingUserEmail: pending.email,
            expiresAt: createUTCDate(24) // Reset expiration - 24 hours from now in UTC
          },
          { new: true }
        );
        console.log('✅ Updated existing CheckoutSession:', checkout._id);
      } else {
        console.log('🆕 Creating new CheckoutSession');
        checkout = await CheckoutSession.create({
          pendingUserId: pending._id,
          pendingUserEmail: pending.email,
          stripeSessionId: null, // placeholder until Stripe responds
          expiresAt: createUTCDate(24) // 24 hours from now in UTC
        });
        console.log('✅ Created new CheckoutSession:', checkout._id);
      }
    } catch (checkoutError) {
      console.error('❌ Error creating/updating CheckoutSession:', checkoutError);
      throw checkoutError;
    }

    // 9. Generate & store the verification token (for both new and updated users)
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
      
      const tokenExpiry = createUTCDate(24); // 24h from now in UTC
      pending.emailVerificationTokenHash = hash;
      pending.emailVerificationTokenExpires = tokenExpiry;
      await pending.save();
      console.log('✅ Token hash saved to database');
      console.log('🔍 Token expiry debug:', {
        tokenExpiry,
        currentTime: createUTCDate(),
        timeUntilExpiry: tokenExpiry.getTime() - createUTCDate().getTime(),
        expiresAt: pending.expiresAt,
        tokenExpiryISO: tokenExpiry.toISOString(),
        currentTimeISO: getCurrentUTCISO(),
        expiresAtISO: pending.expiresAt?.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } catch (tokenError) {
      console.error('❌ Error generating/saving token:', tokenError);
      throw tokenError;
    }

    // 10. Send the verification e-mail (pre-checkout) - for both new and updated users
    console.log('📧 About to send verification email...');
    console.log('📧 Email data:', {
      email: pending.email,
      name: `${pending.name.first} ${pending.name.last}`,
      tokenLength: tokenLength,
      userId: pending._id.toString(),
      isUpdate: !!existingPendingUser
    });
    
    try {
      await sendVerificationEmail({
        email: pending.email,
        name: `${pending.name.first} ${pending.name.last}`,
        userId: pending._id.toString(),
        token: token, // Pass the token that was already generated and stored
      });
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending verification email:', emailError);
      // Don't fail the entire request if email fails
    }
    
    res.status(201).json({ 
      pendingUserId: pending._id,
      checkoutSessionId: checkout._id,
      isUpdate: !!existingPendingUser
    });
  } catch (err: any) {
    console.error('❌ Pending user creation error:', err instanceof Error ? err.message : 'Unknown error');
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
      email: req.body.email,
      username: req.body.username,
      hasPassword: !!req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      levelKey: req.body.levelKey,
      hasFile: !!req.file,
      contentType: req.get('Content-Type')
    });
    
    // Handle specific database errors
    if (err.code === 11000) {
      // Duplicate key error - check which field caused it
      console.log('❌ Database duplicate key error (11000):', {
        code: err.code,
        keyPattern: err.keyPattern,
        keyValue: err.keyValue,
        message: err.message
      });
      
      // Check which field caused the duplicate key error
      if (err.keyPattern && err.keyValue) {
        if (err.keyPattern.stripeSessionId) {
          console.log('⚠️ Duplicate stripeSessionId detected - this should not happen with unique constraint removed');
          return res.status(409).json({ message: 'Checkout session conflict - please try again' });
        } else if (err.keyPattern.email) {
          return res.status(409).json({ message: 'Email is already being used' });
        } else if (err.keyPattern.username) {
          return res.status(409).json({ message: 'Username is already taken' });
        }
      }
      
      // Fallback for unknown duplicate key errors
      return res.status(409).json({ message: 'Email or username already exists' });
    }
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((err: any) => err.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/register
 * Body: { email, username, password, firstName, lastName, levelKey, profilePic? }
 * Returns: { token, user }
 */
router.post('/register', 
  express.json(),
  addSecurityHeaders,
  createRateLimiter(10, 15 * 60 * 1000, 'email'), // 10 registrations per 15 minutes per email (prevent spam)
  async (req, res) => {
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
    if (!email || !username || !password || !firstName || !lastName) {
      console.log('Missing required fields:', { email, username, password: !!password, firstName, lastName });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 2. Check for existing User (permanent) - block registration if real user exists
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);
    
    console.log('▶️ Checking for existing user with', { normalizedEmail, normalizedUsername });

    // run the query using properly normalized values
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    // dump what came back
    console.log('🔎 existingUser →', existingUser);
    if (existingUser) {
      return res
        .status(409)
        .json({ 
          message: existingUser.email === normalizedEmail ? 'Email is already being used' : 'Username is already taken'
        });
    }

    // 3. Check for existing PendingUser - handle expiration properly (REGISTER ENDPOINT)
    console.log('🔍 Checking for existing PendingUser with:', { normalizedEmail, normalizedUsername });
    const pendingUserResult = await findAndHandleExpiredPendingUser(normalizedEmail, normalizedUsername);
    
    if (pendingUserResult.found) {
      console.log(`🔍 Found existing PendingUser for ${email}:`, {
        id: pendingUserResult.pendingUser._id,
        expiresAt: pendingUserResult.expirationInfo.expiresAt,
        now: pendingUserResult.expirationInfo.now,
        isExpired: pendingUserResult.expirationInfo.isExpired,
        timeUntilExpiry: pendingUserResult.expirationInfo.timeUntilExpiry
      });
      
      if (pendingUserResult.expirationInfo.isExpired) {
        console.log(`🗑️ PendingUser has expired, cleaned up and allowing re-registration`);
        console.log(`🗑️ Cleaned up ${pendingUserResult.expirationInfo.deletedCheckoutSessions} related CheckoutSession records`);
      } else {
        console.log(`⏳ PendingUser is still valid, blocking re-registration`);
        
        // Calculate time remaining
        const timeRemaining = pendingUserResult.expirationInfo.timeUntilExpiry;
        const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
        
        return res.status(409).json({ 
          message: `Registration already in progress for this email/username. Please complete your payment or wait ${hoursRemaining} hours for the session to expire.`,
          code: 'PENDING_REGISTRATION',
          expiresAt: pendingUserResult.expirationInfo.expiresAt,
          timeRemaining: timeRemaining
        });
      }
    }

  } catch (err) {
    console.error('User registration error:', err instanceof Error ? err.message : 'Unknown error');
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/auth/pending-registration/:email
 * Returns pending registration status for an email
 */
router.get('/pending-registration/:email', 
  addSecurityHeaders,
  createRateLimiter(30, 15 * 60 * 1000, 'email'), // 30 checks per 15 minutes per email (prevent enumeration)
  async (req, res) => {
  try {
    await connectToDatabase();
    
    const { email } = req.params;
    const normalizedEmail = normalizeEmail(email);
    
    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    
    if (!pendingUser) {
      return res.status(404).json({ message: 'No pending registration found' });
    }
    
          const now = createUTCDate();
    const isExpired = pendingUser.expiresAt < now;
    const timeRemaining = pendingUser.expiresAt.getTime() - now.getTime();
    const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
    
    return res.json({
      found: true,
      isExpired,
      expiresAt: pendingUser.expiresAt,
      timeRemaining,
      hoursRemaining,
      levelKey: pendingUser.levelKey,
      username: pendingUser.username
    });
  } catch (err) {
    console.error('Error checking pending registration:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/auth/pending-user/:pendingUserId
 * Returns pending user information by ID
 */
router.get('/pending-user/:pendingUserId', 
  addSecurityHeaders,
  createRateLimiter(30, 15 * 60 * 1000), // 30 checks per 15 minutes per IP (prevent enumeration)
  async (req, res) => {
  try {
    await connectToDatabase();
    
    const { pendingUserId } = req.params;
    
    if (!pendingUserId) {
      return res.status(400).json({ message: 'Missing pending user ID' });
    }
    
    const pendingUser = await PendingUser.findById(pendingUserId);
    
    if (!pendingUser) {
      return res.status(404).json({ message: 'Pending user not found' });
    }
    
    // Only return safe information (no password hash)
    return res.json({
      _id: pendingUser._id,
      email: pendingUser.email,
      username: pendingUser.username,
      name: pendingUser.name,
      levelKey: pendingUser.levelKey,
      expiresAt: pendingUser.expiresAt,
      emailVerified: pendingUser.emailVerified
    });
  } catch (err) {
    console.error('Error fetching pending user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { identifier, password }
 */
router.post('/login', 
  addSecurityHeaders,
  createRateLimiter(100, 15 * 60 * 1000), // 100 login attempts per 15 minutes per IP (prevent brute force)
  async (req, res) => {
  try {
    console.log('🔐 Login request received:', { 
      identifier: req.body.identifier ? 'Provided' : 'Missing',
      password: req.body.password ? 'Provided' : 'Missing'
    });
    
    await connectToDatabase();
  
  const { identifier, password, recaptchaToken } = req.body;
  if (!identifier || !password) {
    console.log('❌ Login failed - missing fields');
    return res.status(400).json({ message: 'Missing fields' });
  }

  // reCAPTCHA verification
  if (!recaptchaToken) {
    console.log('❌ Missing reCAPTCHA token');
    return res.status(400).json({ message: 'Security verification required. Please refresh the page and try again.' });
  }

  console.log('🔍 Verifying reCAPTCHA token for login...');
  const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
  
  if (!recaptchaResult.success) {
    console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
    return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
  }

  // Check if score is acceptable for login
  const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'login', 0.5);
  if (!isScoreAcceptable) {
    console.log('❌ reCAPTCHA score too low for login:', recaptchaResult.score);
    return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
  }

  console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);

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

  // Get user's active subscription for membership info
  const activeSubscription = await Subscription.findOne({ 
    userId: user._id, 
    status: 'ACTIVE' 
  }).populate('levelId');

  console.log('🔍 Active subscription found:', activeSubscription ? 'Yes' : 'No');

  const tokenPayload = { 
    id: user._id, 
    membershipLevel: user.membershipLevel || (activeSubscription?.levelId as any)?.key || null 
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
 * GET /api/auth/verify-email
 * Verifies email using token from verification link
 * Immediate token cleanup, expiration handling
 */
router.get('/verify-email', 
  addSecurityHeaders,
  createRateLimiter(50, 15 * 60 * 1000), // 50 requests per 15 minutes per user/email (production rate limit)
  async (req, res) => {
    try {
      await connectToDatabase();
      const { token, pendingUserId } = req.query as { token?: string; pendingUserId?: string };
      
      console.log('🔍 Verification request received:', {
        token: token ? `${token.substring(0, 8)}...` : 'undefined',
        tokenLength: token?.length,
        pendingUserId,
        queryParams: req.query
      });
      
      if (!token || !pendingUserId) {
        return res.status(400).json({ message: 'Invalid verification link' });
      }

      // Find pending user with valid token
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      console.log('🔍 Token hash debug:', {
        tokenLength: token.length,
        hashLength: hash.length,
        hashPrefix: hash.substring(0, 8),
        pendingUserId
      });
      
      const pending = await PendingUser.findOne({
        _id: pendingUserId,
        emailVerificationTokenHash: hash,
        emailVerificationTokenExpires: { $gt: createUTCDate() },
      });

      if (!pending) {
        console.log('❌ Token validation failed:', {
          pendingUserId,
          tokenHash: hash,
          currentTime: createUTCDate(),
          reason: 'No pending user found with valid token'
        });
        return res.status(400).json({ 
          message: 'Verification link is invalid or has expired. Please request a new link.',
          code: 'LINK_EXPIRED'
        });
      }

      // Debug: Log the date comparisons
              const currentTime = createUTCDate();
      console.log('🔍 Date validation debug:', {
        pendingUserId: pending._id,
        tokenExpires: pending.emailVerificationTokenExpires,
        registrationExpires: pending.expiresAt,
        currentTime,
        tokenValid: pending.emailVerificationTokenExpires > currentTime,
        registrationValid: pending.expiresAt > currentTime,
        tokenExpiresISO: pending.emailVerificationTokenExpires?.toISOString(),
        registrationExpiresISO: pending.expiresAt?.toISOString(),
        currentTimeISO: currentTime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      // Check if user has already expired (24h from creation)
      if (pending.expiresAt < currentTime) {
        console.log('❌ Registration expired:', {
          pendingUserId: pending._id,
          expiresAt: pending.expiresAt,
          currentTime,
          timeDifference: currentTime.getTime() - pending.expiresAt.getTime()
        });
        return res.status(400).json({ 
          message: 'Your registration has expired. Please register again.',
          code: 'REGISTRATION_EXPIRED'
        });
      }

      // Mark email as verified and immediately clean up token (single use)
      pending.emailVerified = true;
      pending.emailVerificationTokenHash = undefined;
      pending.emailVerificationTokenExpires = undefined;
      
      // Optionally extend expiration for verified users (as per production guidelines)
      // This gives verified users more time to complete payment
              const newExpiresAt = createUTCDate(24); // +24h from now in UTC
      pending.expiresAt = newExpiresAt;
      
      await pending.save();

      res.json({ 
        message: 'Email verified successfully',
        pendingUserId: pending._id.toString(),
        levelKey: pending.levelKey
      });
    } catch (err) {
      console.error('Error verifying email:', err);
      res.status(500).json({ message: sanitizeError(err) });
    }
  }
);

/**
 * POST /api/auth/resend-verification
 * Resends verification email for a pending user
 */
router.post('/resend-verification',
  addSecurityHeaders,
  createRateLimiter(50, 15 * 60 * 1000), // 50 requests per 15 minutes per user/email (production rate limit)
  async (req, res) => {
    try {
      await connectToDatabase();
      const { pendingUserId } = req.body;
      
      if (!pendingUserId) {
        return res.status(400).json({ message: 'Invalid request' });
      }

      const pending = await PendingUser.findById(pendingUserId);
      
      // Always return 204 to prevent information leakage about which emails exist
      if (!pending) {
        return res.status(204).send();
      }

      // Check if email is already verified
      if (pending.emailVerified) {
        return res.status(204).send();
      }

      // Check if registration has expired
      if (pending.expiresAt < createUTCDate()) {
        return res.status(204).send();
      }

      // Generate new verification token (token rotation)
      const { token, hash } = generateVerificationToken();
      pending.emailVerificationTokenHash = hash;
              pending.emailVerificationTokenExpires = createUTCDate(24); // 24h from now in UTC
      await pending.save();

      // Send new verification email
      await sendVerificationEmail({
        email: pending.email,
        name: `${pending.name.first} ${pending.name.last}`,
        userId: pending._id.toString(),
        token: token, // Pass the newly generated token
      });

      // Always return 204to prevent information leakage
      res.status(204).send();
    } catch (err) {
      console.error('Error resending verification email:', err);
      // Even on error, return 204
      res.status(204).send();
    }
  }
);

export default router;
