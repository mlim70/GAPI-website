import express, { Router } from 'express';
import MembershipLevel from '../models/membershipLevel.model';
import { logger } from '../utils/general/logger';

const router = Router();

/**
 * Get all active membership levels (for public/selectable plans)
 * Excludes sponsor products and other hidden products
 */
router.get('/', async (req, res) => {
  try {
    const membershipLevels = await MembershipLevel.find({ 
      status: 'ACTIVE',
      isHiddenFromMembership: { $ne: true }
    }).sort({ unitAmount: 1 });
    res.json(membershipLevels);
  } catch (err) {
    logger.error('Error in /api/membership-levels:', err);
    res.status(500).json({ error: 'Failed to fetch membership levels' });
  }
});

export default router; 