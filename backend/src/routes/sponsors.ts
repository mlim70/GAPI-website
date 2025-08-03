import { Router } from 'express';
import { getSponsors } from '../utils/aws/sponsorService.js';

const router = Router();

// GET /api/sponsors - Fetch all sponsors from S3 bucket
router.get('/', async (req, res) => {
  try {
    const sponsors = await getSponsors();
    res.json(sponsors);
  } catch (error) {
    console.error('Error fetching sponsors from S3:', error);
    res.status(500).json({ error: 'Failed to fetch sponsors' });
  }
});

export default router; 