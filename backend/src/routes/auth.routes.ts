import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Subscription from '../models/subscription.model.js';
import MembershipLevel from '../models/membershipLevel.model.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    // 1. validate input (use zod/joi or manual)
    const { email, username, password, firstName, lastName, levelKey } = req.body;

    // 2. ensure uniqueness
    if (await User.exists({ $or: [{ email }, { username }] })) {
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    // 3. hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. create user
    const user = await User.create({
      email,
      username,
      passwordHash,
      name: { first: firstName, last: lastName },
    });

    // 5. (optional) pre-create subscription in PENDING state
    let subscription;
    if (levelKey) {
      const level = await MembershipLevel.findOne({ key: levelKey });
      if (!level) return res.status(400).json({ message: 'Invalid membership level' });

      subscription = await Subscription.create({
        userId: user._id,
        levelId: level._id,
        gatewaySubId: 'PENDING',     // replace after PayPal approval
        status: 'PENDING',
        startDate: new Date(),
      });
    }

    // 6. generate JWT (or session cookie)
    // const token = signJwt({ sub: user.id });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
      subscriptionId: subscription?.id,
      // token,
    });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 