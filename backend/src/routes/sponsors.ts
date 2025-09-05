import { Router } from 'express';
import { getSponsors } from '../services/aws/sponsorService';
import { fixedWindowLimiter, ipId } from '../middleware/limit';
import { logger } from '../utils/general/logger';

const router = Router();

// GET /api/sponsors - Fetch all sponsors from S3 bucket
router.get('/', 
  fixedWindowLimiter({
    windowMs: 15 * 60_000,
    max: 500,
    prefix: "rl:sponsors",
    idFn: ipId,
    routeKey: () => "/api/sponsors",
  }),
  async (req, res) => {
  try {
    const sponsors = await getSponsors();
    res.json(sponsors);
  } catch (error) {
    logger.error('Error fetching sponsors from S3:', error);
    res.status(500).json({ error: 'Failed to fetch sponsors' });
  }
});

export default router; 