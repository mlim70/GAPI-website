import { Router } from 'express';
import { processEmailJobs } from '../services/emailWorker';
import { connectToDatabase } from '../utils/db';

const router = Router();

router.post('/process', async (req, res) => {
  try {
    // Verify the request is from Vercel Cron (optional security)
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🕐 Vercel Cron triggered email processing');
    
    // Connect to database
    await connectToDatabase();
    
    // Process email jobs
    await processEmailJobs();
    
    res.status(200).json({ 
      success: true, 
      message: 'Email processing completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Email processor endpoint failed:', error);
    res.status(500).json({ 
      error: 'Email processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manual trigger endpoint (for testing)
 */
router.post('/manual', async (req, res) => {
  try {
    console.log('🔧 Manual email processing triggered');
    
    await connectToDatabase();
    await processEmailJobs();
    
    res.status(200).json({ 
      success: true, 
      message: 'Manual email processing completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual email processing failed:', error);
    res.status(500).json({ 
      error: 'Manual email processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
