// backend/src/routes/carousels.ts
import express from 'express';
import { getCarouselImages, getImageByKey, CarouselType } from '../utils/s3MultiBucket.js';


const router = express.Router();

/**
 * GET /api/carousels/test
 * Test S3 connectivity
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing S3 connectivity...');
    console.log('🔑 AWS Environment variables:');
    console.log('- AWS_REGION:', process.env.AWS_REGION);
    console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
    console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
    
    const images = await getCarouselImages('eventCarousel');
    
    res.json({
      success: true,
      message: 'S3 test completed',
      imageCount: images.length,
      images: images.slice(0, 3) // Show first 3 images for debugging
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

/**
 * GET /api/carousels/:type
 * Get images for a specific carousel type
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    // Validate carousel type
    const validTypes: CarouselType[] = ['heroCarousel', 'eventCarousel'];
    if (!validTypes.includes(type as CarouselType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid carousel type. Must be one of: heroCarousel, eventCarousel'
      });
    }

    // Fetch from S3
    const images = await getCarouselImages(type as CarouselType);
    
    res.json({
      success: true,
      data: {
        type,
        images,
        count: images.length
      }
    });
  } catch (error) {
    console.error('Error fetching carousel images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch carousel images'
    });
  }
});

/**
 * GET /api/carousels/:type/image/:key
 * Get a specific image by key
 */
router.get('/:type/image/:key(*)', async (req, res) => {
  try {
    const { type, key } = req.params;
    
    // Validate carousel type
    const validTypes: CarouselType[] = ['heroCarousel', 'eventCarousel'];
    if (!validTypes.includes(type as CarouselType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid carousel type'
      });
    }

    const image = await getImageByKey(type as CarouselType, key);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image'
    });
  }
});

/**
 * GET /api/carousels
 * Get all carousel types and their image counts
 */
router.get('/', async (req, res) => {
  try {
    const carouselTypes: CarouselType[] = ['heroCarousel', 'eventCarousel'];
    const results = await Promise.all(
      carouselTypes.map(async (type) => {
        const images = await getCarouselImages(type);
        return {
          type,
          count: images.length,
          lastUpdated: images.length > 0 ? images[0].lastModified : null
        };
      })
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching carousel summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch carousel summary'
    });
  }
});

export default router; 