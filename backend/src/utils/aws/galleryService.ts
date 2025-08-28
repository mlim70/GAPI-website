// backend/src/utils/aws/galleryService.ts
import S3Service, { S3Image } from './s3Service';
import { S3_BUCKETS, S3_FOLDERS } from './s3Config';
import { logger } from '../logger';

const s3Service = S3Service.getInstance();

export interface GalleryImage extends S3Image {
}

export interface GalleryResult {
  bucket: string;
  folder: string;
  images: GalleryImage[];
  count: number;
}

/**
 * Get images from a gallery folder
 */
export async function getGalleryImages(
  bucket: string, 
  folder: string, 
  maxImages: number = 50
): Promise<GalleryResult> {
  const startTime = Date.now();
  
  try {
    logger.info(`📋 [GALLERY SERVICE] Listing objects in bucket: ${bucket}, folder: ${folder}`);
    const objects = await s3Service.listObjects(bucket, folder, maxImages);
    
    if (!objects || objects.length === 0) {
      logger.warn(`⚠️ [GALLERY SERVICE] No objects found in bucket: ${bucket}, folder: ${folder}`);
      return {
        bucket,
        folder,
        images: [],
        count: 0
      };
    }
    
    // Filter for image files and sort by last modified
    const imageObjects = s3Service.filterImageFiles(objects);
    
    // Generate presigned URLs for all images to avoid CORS issues
    const images = await Promise.all(
      imageObjects
        .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
        .map(async (obj, index) => {
          const key = obj.Key!;
          const presignedUrl = await s3Service.getPresignedUrl(bucket, key, 3600); // 1 hour expiry
          
          const imageData = {
            key,
            url: presignedUrl,
            filename: key.split('/').pop() || '',
            lastModified: obj.LastModified || new Date(),
            size: obj.Size || 0
          };
          
          return imageData;
        })
    );

    const result = {
      bucket,
      folder,
      images,
      count: images.length
    };

    return result;
  } catch (error) {
    logger.error(`❌ [GALLERY SERVICE] Error fetching gallery images:`, {
      bucket,
      folder,
      maxImages,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to fetch gallery images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get hero carousel images
 */
export async function getHeroImages(): Promise<GalleryImage[]> {  
  if (!S3_BUCKETS.website) {
    logger.error(`❌ [GALLERY SERVICE] Website bucket not configured`);
    throw new Error('Website bucket not configured');
  }

  const result = await getGalleryImages(S3_BUCKETS.website, S3_FOLDERS.hero);
  return result.images;
}

/**
 * Get gallery carousel images
 */
export async function getEventImages(): Promise<GalleryImage[]> {
  
  if (!S3_BUCKETS.website) {
    logger.error(`❌ [GALLERY SERVICE] Website bucket not configured`);
    throw new Error('Website bucket not configured');
  }

  const result = await getGalleryImages(S3_BUCKETS.website, S3_FOLDERS.events);
  return result.images;
}

/**
 * Get clinic hero images
 */
export async function getClinicHeroImages(): Promise<GalleryImage[]> {

  if (!S3_BUCKETS.clinic) {
    logger.error(`❌ [GALLERY SERVICE] Clinic bucket not configured`);
    throw new Error('Clinic bucket not configured');
  }

    const result = await getGalleryImages(S3_BUCKETS.clinic, S3_FOLDERS.hero);
  return result.images;
} 