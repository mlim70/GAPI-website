// backend/src/routes/s3.ts
import express from 'express';
import S3Service, { S3Image } from '../utils/s3Service';
import { S3_CONFIG } from '../utils/s3Config';

const router = express.Router();
const s3Service = S3Service.getInstance();

/**
 * GET /api/s3/:bucket/folder/:folder(*)
 * List all images in a folder
 */
router.get('/:bucket/folder/:folder(*)', async (req, res) => {
  try {
    const { bucket, folder } = req.params;
    const { getGalleryImages } = await import('../utils/galleryService.js');
    const result = await getGalleryImages(bucket, folder, 50);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(`❌ Error listing S3 images in folder ${req.params.folder} from bucket ${req.params.bucket}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to list images'
    });
  }
});

/**
 * GET /api/s3/:bucket/:key(*)
 * Get a single image from any S3 bucket
 */
router.get('/:bucket/:key(*)', async (req, res) => {
  try {
    const { bucket, key } = req.params;
    
    console.log(`🔍 Fetching S3 image: ${key} from bucket: ${bucket}`);
    
    const response = await s3Service.getObject(bucket, key);
    
    if (!response.Body) {
      console.log(`❌ No body found for S3 image: ${key}`);
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const imageData: S3Image = {
      key,
      url: s3Service.generateDirectUrl(bucket, key),
      filename: key.split('/').pop() || '',
      lastModified: response.LastModified || new Date(),
      size: response.ContentLength || 0
    };

    console.log(`✅ S3 image fetched successfully:`, imageData);
    
    res.json({
      success: true,
      data: imageData
    });
  } catch (error) {
    console.error(`❌ Error fetching S3 image ${req.params.key} from bucket ${req.params.bucket}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image'
    });
  }
});

/**
 * GET /api/s3/test
 * Test S3 connectivity and show environment variables
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing S3 connectivity...');
    console.log('🔑 AWS Environment variables:');
    console.log('- AWS_REGION:', S3_CONFIG.region);
    console.log('- AWS_ACCESS_KEY_ID:', S3_CONFIG.accessKeyId ? 'SET' : 'NOT SET');
    console.log('- AWS_SECRET_ACCESS_KEY:', S3_CONFIG.secretAccessKey ? 'SET' : 'NOT SET');
    
    res.json({
      success: true,
      message: 'S3 API is working',
      config: {
        region: S3_CONFIG.region,
        hasCredentials: S3_CONFIG.hasCredentials
      }
    });
  } catch (error) {
    console.error('❌ S3 test failed:', error);
    res.status(500).json({
      success: false,
      message: 'S3 test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 