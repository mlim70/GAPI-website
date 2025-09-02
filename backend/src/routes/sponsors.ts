import { Router } from 'express';
import { getSponsors } from '../services/aws/sponsorService';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { createRedisRateLimiter, ipKey } from '../utils/accounts/redisLimiter';
import { logger } from '../utils/general/logger';

const router = Router();

// GET /api/sponsors - Fetch all sponsors from S3 bucket
router.get('/', 
  createRedisRateLimiter(500, 15 * 60 * 1000, ipKey), // 500 sponsor fetches per 15 minutes per IP
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