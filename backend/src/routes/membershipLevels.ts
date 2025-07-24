import { Router } from 'express';
import MembershipLevel from '../models/membershipLevel.model.js';

const router = Router();

// GET /api/membership-levels
router.get('/', async (req, res) => {
  try {
    const levels = await MembershipLevel.find({}, '-__v').lean();
    res.json(levels);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch membership levels' });
  }
});

export default router; 