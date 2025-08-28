import { Router } from 'express';
import { getSponsors } from '../utils/aws/sponsorService';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/sponsors - Fetch all sponsors from S3 bucket
router.get('/', 
  createRateLimiter(500, 15 * 60 * 1000), // 500 sponsor fetches per 15 minutes per IP
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