import { Router } from 'express';
import { uploadFileToS3, upload } from '../utils/fileUpload';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';
import MembershipLevel from '../models/membershipLevel.model';
import Subscription from '../models/subscription.model';
import express from 'express';


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
    // 0) short‐circuit if DB is down
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: 'Database connection error' });
    }
    
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

    // 2. Check for existing User (permanent)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    // 3. Check for existing PendingUser (only enforce for JSON requests, not multipart)
    if (!isMultipart) {
      const existingPendingUser = await PendingUser.findOne({ $or: [{ email }, { username }] });
      if (existingPendingUser) {
        // If the pending user is older than 1 hour, delete it and allow re-registration
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (existingPendingUser.createdAt < oneHourAgo) {
          console.log(`🗑️ Cleaning up old PendingUser for ${email} (created: ${existingPendingUser.createdAt})`);
          await PendingUser.findByIdAndDelete(existingPendingUser._id);
        } else {
          return res.status(409).json({ message: 'Email or username already exists' });
        }
      }
    }

    // 5. verify levelKey exists
    const level = await MembershipLevel.findOne({ key: levelKey });
    console.log('Looking for levelKey:', levelKey);
    console.log('Found level:', level ? level.key : 'NOT FOUND');
    if (!level) return res.status(400).json({ message: 'Invalid levelKey' });

    // 6. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 7. upload profile picture to S3 if provided (only for multipart requests)
    let avatarUrl: string | undefined;
    if (isMultipart && req.file) {
      try {
        avatarUrl = await uploadFileToS3(req.file, 'avatars');
      } catch (uploadError) {
        console.warn('Avatar upload failed, proceeding with default avatar:', uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
        // Fall back to default avatar instead of failing the entire request
        avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://cdn.example.com/default-avatar.png';
      }
    }

    // 8. stash in PendingUser until Stripe confirms payment
    try {
      console.log('Creating pending user with data:', { email, username, levelKey });
      const pending = await PendingUser.create({
        email,
        username,
        passwordHash,
        name: { first: firstName, last: lastName },
        levelKey,
        avatarUrl, // Store the avatar URL in pending user
      });
      console.log('Pending user created successfully:', pending._id);

      // 9. Create CheckoutSession to track the payment attempt
      const checkout = await CheckoutSession.create({
        pendingUserId: pending._id,
        pendingUserEmail: pending.email, // Add the required email field
        stripeSessionId: 'PENDING', // placeholder until Stripe responds
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      res.status(201).json({ 
        pendingUserId: pending._id,
        checkoutSessionId: checkout._id 
      });
    } catch (err: any) {
      console.log('Error creating pending user:', err.message, err.code, err.name);
      if (err.code === 11000) {
        // Duplicate key (email/username)
        return res.status(409).json({ message: 'Email or username already exists' });
      }
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((err: any) => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      throw err; // propagate other errors
    }
  } catch (err) {
    console.error('Pending user creation error:', err instanceof Error ? err.message : 'Unknown error');
    console.error('Full error details:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : 'No stack trace',
      name: err instanceof Error ? err.name : 'Unknown error type'
    });
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/register
 * Body: { email, username, password, firstName, lastName, levelKey, profilePic? }
 * Returns: { token, user }
 */
router.post('/register', 
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
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      levelKey,
    } = req.body;

    // 1. basic validation (more on front-end)
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // 2. ensure unique email/username
    if (await User.exists({ $or: [{ email }, { username }] })) {
      return res
        .status(409)
        .json({ message: 'Email or username already exists' });
    }

    // 3. verify levelKey exists (if provided)
    let membershipLevel = null;
    if (levelKey) {
      const level = await MembershipLevel.findOne({ key: levelKey });
      if (!level) return res.status(400).json({ message: 'Invalid levelKey' });
      membershipLevel = level.key;
    }

    // 4. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. upload profile picture to S3 if provided
    let avatarUrl: string | undefined;
    if (req.file) {
      try {
        avatarUrl = await uploadFileToS3(req.file, 'avatars');
      } catch (uploadError) {
        console.warn('Avatar upload failed, proceeding with default avatar:', uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
        // Fall back to default avatar instead of failing the entire request
        avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://cdn.example.com/default-avatar.png';
      }
    }

    // 6. store user
    try {
      const user = await User.create({
        email,
        username,
        passwordHash,
        name: { first: firstName, last: lastName },
        avatarUrl,
        role: 'subscriber',
      });





      // 9. sign JWT & return
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user });
    } catch (validationErr: any) {
      if (validationErr.name === 'ValidationError') {
        const errors = Object.values(validationErr.errors).map((err: any) => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      throw validationErr;
    }
  } catch (err) {
    console.error('User registration error:', err instanceof Error ? err.message : 'Unknown error');
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { identifier, password }
 */
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ message: 'Missing fields' });

  // lookup by email OR username
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  // remove hash from payload
  const safeUser = user.toObject();
  delete safeUser.passwordHash;

  // Get user's active subscription for membership info
  const activeSubscription = await Subscription.findOne({ 
    userId: user._id, 
    status: 'ACTIVE' 
  }).populate('levelId');

  const token = jwt.sign(
    { 
      id: user._id, 
      role: user.role, 
      membershipLevel: (activeSubscription?.levelId as any)?.key || null 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: safeUser });
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
    jwt.verify(auth, JWT_SECRET!);
    return res.status(200).json({ valid: true });
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
