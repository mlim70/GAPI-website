import express, { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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


// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const router = Router();

/** POST /api/auth/pending-user **/ 

// Debug endpoint to test basic functionality
router.get('/debug', async (req, res) => {
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
      timestamp: new Date().toISOString()
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

    // 2. Check for existing User (permanent) - block registration if real user exists
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

    // 3. Check for existing PendingUser - update if valid, clean up if expired
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

    // 4. verify levelKey exists
    const level = await MembershipLevel.findOne({ key: levelKey });
    console.log('Looking for levelKey:', levelKey);
    console.log('Found level:', level ? level.key : 'NOT FOUND');
    if (!level) return res.status(400).json({ message: 'Invalid levelKey' });

    // 5. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 6. Create or update PendingUser
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
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Reset expiration
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
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Reset expiration
          },
          { new: true }
        );
        console.log('✅ Updated existing CheckoutSession:', checkout._id);
      } else {
        console.log('🆕 Creating new CheckoutSession');
        checkout = await CheckoutSession.create({
          pendingUserId: pending._id,
          pendingUserEmail: pending.email,
          stripeSessionId: 'PENDING', // placeholder until Stripe responds
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        console.log('✅ Created new CheckoutSession:', checkout._id);
      }
    } catch (checkoutError) {
      console.error('❌ Error creating/updating CheckoutSession:', checkoutError);
      throw checkoutError;
    }

    // 8. Generate & store the verification token (for both new and updated users)
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
      
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      pending.emailVerificationTokenHash = hash;
      pending.emailVerificationTokenExpires = tokenExpiry;
      await pending.save();
      console.log('✅ Token hash saved to database');
      console.log('🔍 Token expiry debug:', {
        tokenExpiry,
        currentTime: new Date(),
        timeUntilExpiry: tokenExpiry.getTime() - new Date().getTime(),
        expiresAt: pending.expiresAt,
        tokenExpiryISO: tokenExpiry.toISOString(),
        currentTimeISO: new Date().toISOString(),
        expiresAtISO: pending.expiresAt?.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } catch (tokenError) {
      console.error('❌ Error generating/saving token:', tokenError);
      throw tokenError;
    }

    // 9. Send the verification e-mail (pre-checkout) - for both new and updated users
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
router.get('/pending-registration/:email', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { email } = req.params;
    const normalizedEmail = normalizeEmail(email);
    
    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    
    if (!pendingUser) {
      return res.status(404).json({ message: 'No pending registration found' });
    }
    
    const now = new Date();
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
router.get('/pending-user/:pendingUserId', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

  // lookup by email OR username (normalize both email and username)
  const normalizedIdentifier = identifier.includes('@') ? normalizeEmail(identifier) : normalizeUsername(identifier);
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
router.get('/verify', (req, res) => {
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
  createRateLimiter(200, 1 * 60 * 1000), // TODO: 200 requests per minute (increased for testing)
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
        emailVerificationTokenExpires: { $gt: new Date() },
      });

      if (!pending) {
        console.log('❌ Token validation failed:', {
          pendingUserId,
          tokenHash: hash,
          currentTime: new Date(),
          reason: 'No pending user found with valid token'
        });
        return res.status(400).json({ 
          message: 'Verification link is invalid or has expired. Please request a new link.',
          code: 'LINK_EXPIRED'
        });
      }

      // Debug: Log the date comparisons
      const currentTime = new Date();
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
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
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
  createRateLimiter(200, 1 * 60 * 1000), // 200 requests per 15 minutes (increased for testing)
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
      if (pending.expiresAt < new Date()) {
        return res.status(204).send();
      }

      // Generate new verification token (token rotation)
      const { token, hash } = generateVerificationToken();
      pending.emailVerificationTokenHash = hash;
      pending.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
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
