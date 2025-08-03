import { uploadFileToS3, upload } from '../utils/aws/fileUpload';
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import MembershipLevel from '../models/membershipLevel.model';
import Subscription from '../models/subscription.model';
import { connectToDatabase } from '../utils/db';
import { normalizeEmail, areEmailsEquivalent } from '../utils/email/emailUtils';
import { normalizeUsername } from '../utils/accounts/usernameUtils';
import { findAndHandleExpiredPendingUser } from '../utils/accounts/pendingUserUtils';
import { sendVerificationEmail, testTokens } from '../utils/email/email';
import { generateVerificationToken } from '../utils/accounts/tokens';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { addSecurityHeaders, sanitizeError } from '../utils/accounts/security';


// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const router = Router();

/** POST /api/auth/pending-user **/ 
router.post(
  '/pending-user',
  express.json(),
  upload.single('profilePic'),
  // Error handling middleware for Multer
  (err: any, req: any, res: any, next: any) => {
    if (err && err.code) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Only 1 file allowed.' });
      }
      if (err.code === 'LIMIT_FIELD_VALUE') {
        return res.status(400).json({ message: 'Field too large. Maximum size is 1MB.' });
      }
      return res.status(400).json({ message: 'File upload error: ' + err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  },
  async (req, res) => {
    await connectToDatabase();
    
    // Use content-type detection instead of req.file
    const isMultipart = req.is('multipart/form-data');
    
    try {
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

    // 6. upload profile picture to S3 if provided (only for multipart requests)
    let avatarUrl: string | undefined;
    if (isMultipart && req.file) {
      try {
        avatarUrl = await uploadFileToS3(req.file);
      } catch (uploadError) {
        console.warn('Avatar upload failed, proceeding with default avatar:', uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
        // Fall back to default avatar instead of failing the entire request
        avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://cdn.example.com/default-avatar.png';
      }
    }

    // 7. Create or update PendingUser
    let pending;
    
    if (existingPendingUser) {
      console.log('🔄 Updating existing PendingUser:', existingPendingUser._id);
      console.log('📝 Updating with latest form data:', {
        email: normalizedEmail,
        username: normalizedUsername,
        firstName,
        lastName,
        levelKey,
        hasAvatar: !!avatarUrl
      });
      
      // Update existing pending user with latest form data (not original data)
      pending = await PendingUser.findByIdAndUpdate(
        existingPendingUser._id,
        {
          passwordHash, // Latest password
          name: { first: firstName, last: lastName }, // Latest name
          levelKey, // Latest membership level
          avatarUrl, // Latest profile picture
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Reset expiration
        },
        { new: true }
      );
      console.log('✅ Updated existing PendingUser with latest data:', pending._id);
    } else {
      console.log('🆕 Creating new PendingUser with data:', { 
        originalEmail: email, 
        normalizedEmail, 
        originalUsername: username, 
        normalizedUsername, 
        levelKey 
      });
      
      pending = await PendingUser.create({
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        name: { first: firstName, last: lastName },
        levelKey,
        avatarUrl,
      });
      console.log('✅ Created new PendingUser:', pending._id);
    }

    // 8. Create or update CheckoutSession
    let checkout;
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

    // 8. Generate & store the verification token
    console.log('🔑 Generating verification token...');
    const { token, hash } = generateVerificationToken();
    console.log('✅ Token generated, length:', token.length);
    
    pending.emailVerificationTokenHash = hash;
    pending.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await pending.save();
    console.log('✅ Token hash saved to database');

    // 9. Send the verification e-mail (pre-checkout)
    console.log('📧 About to send verification email...');
    console.log('📧 Email data:', {
      email: pending.email,
      name: `${pending.name.first} ${pending.name.last}`,
      tokenLength: token.length,
      userId: pending._id.toString()
    });
    
    try {
      await sendVerificationEmail({
        email: pending.email,
        name: `${pending.name.first} ${pending.name.last}`,
        token,
        userId: pending._id.toString(),
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
    console.error('Pending user creation error:', err instanceof Error ? err.message : 'Unknown error');
    console.error('Full error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : 'No stack trace',
      name: err instanceof Error ? err.name : 'Unknown error type'
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
  upload.single('profilePic'),
  // Error handling middleware for Multer
  (err: any, req: any, res: any, next: any) => {
    if (err && err.code) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Only 1 file allowed.' });
      }
      if (err.code === 'LIMIT_FIELD_VALUE') {
        return res.status(400).json({ message: 'Field too large. Maximum size is 1MB.' });
      }
      return res.status(400).json({ message: 'File upload error: ' + err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  },
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

    // 4. verify levelKey exists (if provided)
    let membershipLevel = null;
    if (levelKey) {
      const level = await MembershipLevel.findOne({ key: levelKey });
      if (!level) return res.status(400).json({ message: 'Invalid levelKey' });
      membershipLevel = level.key;
    }

    // 5. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 6. upload profile picture to S3 if provided
    let avatarUrl: string | undefined;
    if (req.file) {
      try {
        avatarUrl = await uploadFileToS3(req.file);
      } catch (uploadError) {
        console.warn('Avatar upload failed, proceeding with default avatar:', uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
        // Fall back to default avatar instead of failing the entire request
        avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://cdn.example.com/default-avatar.png';
      }
    }

    // 7. store user
    try {
      const user = await User.create({
        email: normalizedEmail, // Store normalized email
        username: normalizedUsername, // Store normalized username
        passwordHash,
        name: { first: firstName, last: lastName },
        avatarUrl,
        role: 'subscriber',
        membershipLevel,
      });

      // 8. sign JWT & return
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user });
    } catch (err: any) {
      console.log('Error creating user:', err.message, err.code, err.name);
      if (err.code === 11000) {
        // Duplicate key (email/username)
        console.log('❌ Database duplicate key error (11000) in register endpoint:', {
          code: err.code,
          keyPattern: err.keyPattern,
          keyValue: err.keyValue,
          message: err.message
        });
        return res.status(409).json({ message: 'Email or username already exists' });
      }
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((err: any) => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      throw err; // propagate other errors
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
    role: user.role, 
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
  createRateLimiter(200, 1 * 60 * 1000), // 200 requests per 15 minutes (increased for testing)
  async (req, res) => {
    try {
      await connectToDatabase();
      const { token, pendingUserId } = req.query as { token?: string; pendingUserId?: string };
      
      if (!token || !pendingUserId) {
        return res.status(400).json({ message: 'Invalid verification link' });
      }

      // Find pending user with valid token
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const pending = await PendingUser.findOne({
        _id: pendingUserId,
        emailVerificationTokenHash: hash,
        emailVerificationTokenExpires: { $gt: new Date() },
      });

      if (!pending) {
        return res.status(400).json({ 
          message: 'Verification link is invalid or has expired. Please request a new link.',
          code: 'LINK_EXPIRED'
        });
      }

      // Check if user has already expired (24h from creation)
      if (pending.expiresAt < new Date()) {
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
        token,
        userId: pending._id.toString(),
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

/**
 * GET /api/auth/debug/test-tokens
 * Debug endpoint to get test tokens (only in development)
 */
router.get('/debug/test-tokens', (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  console.log('🔍 Debug endpoint called, test tokens count:', testTokens.length);
  
  res.json({
    count: testTokens.length,
    tokens: testTokens.map(t => ({
      email: t.email,
      userId: t.userId,
      token: t.token.substring(0, 10) + '...',
      fullToken: t.token // Include full token for testing
    }))
  });
});

export default router;
