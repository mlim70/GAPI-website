import { Router } from 'express';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import S3Service from '../utils/aws/s3Service';
import { logger } from '../utils/logger';
  
interface S3Image {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

const router = Router();

// SECURITY: Whitelist of allowed buckets and folders to prevent unauthorized access
const ALLOWED_BUCKETS = {
  'gapi-home': ['hero', 'gallery'], // Main website bucket
  'gapi-clinic': ['hero', 'gallery'], // Clinic bucket
  'gapi-exec': ['students-residents'],
  'gapi-sponsors': ['sponsors'], // Sponsors bucket (if needed)
};

// SECURITY: Rate limiting to prevent abuse
const folderListingLimiter = createRateLimiter(100, 15 * 60 * 1000); // 100 folder listings per 15 minutes per IP
const imageFetchLimiter = createRateLimiter(500, 15 * 60 * 1000); // 500 image fetches per 15 minutes per IP

// Debug endpoint to check S3 configuration
router.get('/debug/config', (req, res) => {
  const { S3_BUCKETS, S3_FOLDERS } = require('../utils/aws/s3Config');
  res.json({
    success: true,
    data: {
      buckets: {
        website: S3_BUCKETS.website,
        clinic: S3_BUCKETS.clinic,
        exec: S3_BUCKETS.exec,
      },
      folders: {
        hero: S3_FOLDERS.hero,
        gallery: S3_FOLDERS.gallery,
        exec: S3_FOLDERS.exec,
      },
      allowedBuckets: ALLOWED_BUCKETS,
    }
  });
});

/**
 * GET /api/s3/:bucket/folder/:folder
 * List images in a folder (SECURED - only allowed buckets/folders)
 */
router.get('/:bucket/folder/:folder', 
  folderListingLimiter,
  async (req, res) => {
  const startTime = Date.now();
  const { bucket, folder } = req.params;
  
  logger.debug('S3 ROUTE - Folder listing request received:', {
    bucket,
    folder,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  try {
    // SECURITY: Validate bucket and folder access
    if (!ALLOWED_BUCKETS[bucket] || !ALLOWED_BUCKETS[bucket].includes(folder)) {
      logger.warn('S3 ROUTE - Unauthorized S3 access attempt:', {
        bucket,
        folder,
        allowedBuckets: Object.keys(ALLOWED_BUCKETS),
        allowedFolders: ALLOWED_BUCKETS[bucket] || [],
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    logger.debug('S3 ROUTE - Access validated for bucket and folder:', { bucket, folder });
    
    const { getGalleryImages } = await import('../utils/aws/galleryService.js');
    logger.debug('S3 ROUTE - Gallery service imported, calling getGalleryImages...');
    
    const result = await getGalleryImages(bucket, folder, 50);
    
    logger.debug('S3 ROUTE - Gallery images retrieved successfully:', {
      bucket,
      folder,
      imageCount: result.count,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: { images: result.images }
    });
  } catch (error) {
    logger.error('S3 ROUTE - Error listing S3 images:', {
      bucket,
      folder,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: 'Failed to list images'
    });
  }
});

/**
 * GET /api/s3/:bucket/:key
 * Get a specific image (SECURED - only allowed buckets)
 */
router.get('/:bucket/:key', 
  imageFetchLimiter,
  async (req, res) => {
  const startTime = Date.now();
  const { bucket, key } = req.params;
  
  logger.debug('S3 ROUTE - Image fetch request received:', {
    bucket,
    key,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  try {
    // SECURITY: Validate bucket access
    if (!ALLOWED_BUCKETS[bucket]) {
      logger.warn('S3 ROUTE - Unauthorized S3 bucket access attempt:', {
        bucket,
        allowedBuckets: Object.keys(ALLOWED_BUCKETS),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // SECURITY: Validate key path (only allow images in allowed folders)
    const keyFolder = key.split('/')[0];
    if (!ALLOWED_BUCKETS[bucket].includes(keyFolder)) {
      logger.warn('S3 ROUTE - Unauthorized S3 folder access attempt:', {
        bucket,
        keyFolder,
        key,
        allowedFolders: ALLOWED_BUCKETS[bucket] || [],
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    logger.debug('S3 ROUTE - Access validated for bucket and key:', { bucket, key });
    logger.debug('S3 ROUTE - Fetching S3 image:', { key, bucket });
    
    const response = await S3Service.getInstance().getObject(bucket, key);
    
    logger.debug('S3 ROUTE - S3 object retrieved:', {
      bucket,
      key,
      hasBody: !!response.Body,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      contentType: response.ContentType,
      timestamp: new Date().toISOString()
    });
    
    if (!response.Body) {
      logger.warn('S3 ROUTE - No body found for S3 image:', {
        bucket,
        key,
        timestamp: new Date().toISOString()
      });
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Generate presigned URL to avoid CORS issues
    logger.debug('S3 ROUTE - Generating presigned URL:', { bucket, key });
    const presignedUrl = await S3Service.getInstance().getPresignedUrl(bucket, key, 3600); // 1 hour expiry
    
    const imageData: S3Image = {
      key,
      url: presignedUrl,
      filename: key.split('/').pop() || '',
      lastModified: response.LastModified || new Date(),
      size: response.ContentLength || 0
    };

    logger.debug('S3 ROUTE - S3 image fetched successfully:', {
      bucket,
      key,
      filename: imageData.filename,
      size: imageData.size,
      lastModified: imageData.lastModified,
      presignedUrlLength: presignedUrl.length,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: imageData
    });
  } catch (error) {
    logger.error('S3 ROUTE - Error fetching S3 image:', {
      bucket,
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image'
    });
  }
});

export default router; 