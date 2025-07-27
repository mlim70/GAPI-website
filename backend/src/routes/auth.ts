import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import MembershipLevel from '../models/membershipLevel.model.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is missing');
}
const router = Router();

/**
 * POST /api/auth/pending-user
 * Body: { email, username, password, firstName, lastName, levelKey }
 * Returns: { userId } - temporary user ID for checkout
 */
router.post('/pending-user', async (req, res) => {
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
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 2. ensure unique email/username
    if (await User.exists({ $or: [{ email }, { username }] })) {
      return res
        .status(409)
        .json({ message: 'Email or username already exists' });
    }

    // 3. verify levelKey exists
    const level = await MembershipLevel.findOne({ key: levelKey });
    if (!level) return res.status(400).json({ message: 'Invalid levelKey' });

    // 4. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. create temporary user (will be finalized after successful payment)
    const user = await User.create({
      email,
      username,
      passwordHash,
      name: { first: firstName, last: lastName },
      role: 'subscriber',
      // Note: membershipLevel will be set after successful payment via webhook
    });

    res.status(201).json({ userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/register
 * Body: { email, username, password, firstName, lastName, levelKey, profilePic? }
 * Returns: { token, user }
 */
router.post('/register', async (req, res) => {
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

    // 5. store user
    const user = await User.create({
      email,
      username,
      passwordHash,
      name: { first: firstName, last: lastName },
      role: 'subscriber',
      // Note: membershipLevel field was removed from User model
      // Membership status is now derived from Subscription model
    });

    // 6. optional: handle profilePic from multipart
    // TODO: upload to S3 / Cloudinary – keep this out of scope for now

    // 7. sign JWT & return
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
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

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

export default router;
