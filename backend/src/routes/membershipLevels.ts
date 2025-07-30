import { Router } from 'express';
import MembershipLevel from '../models/membershipLevel.model';
import { connectToDatabase } from '../utils/db';

const router = Router();

// GET /api/membership-levels
router.get('/', async (req, res, next) => {
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