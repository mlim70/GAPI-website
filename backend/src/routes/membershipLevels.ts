import { Router } from 'express';
import MembershipLevel from '../models/membershipLevel.model';
import { connectToDatabase } from '../utils/db';
import { createRateLimiter } from '../utils/accounts/rateLimiter';

const router = Router();

// GET /api/membership-levels
router.get('/', 
  createRateLimiter(1000, 15 * 60 * 1000), // 1000 membership level fetches per 15 minutes per IP (production-ready)
  async (req, res, next) => {
  try {
    await connectToDatabase();
    
    const levels = await MembershipLevel.find().sort('key');
    res.json(levels);
  } catch (err) {
    console.error('Error in /api/membership-levels:', err);
    next(err);
  }
});

export default router; 