import { Router } from 'express';
import MembershipLevel from '@models/membershipLevel.model';

const router = Router();

// GET /api/membership-levels
router.get('/', async (req, res, next) => {
  try {
    const levels = await MembershipLevel.find().sort('key');
    res.json(levels);
  } catch (err) {
    next(err);
  }
});

export default router; 