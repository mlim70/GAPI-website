// backend/src/utils/galleryService.ts
import S3Service, { S3Image } from './s3Service';
import { S3_BUCKETS, S3_FOLDERS } from './s3Config';

const s3Service = S3Service.getInstance();

export interface GalleryImage extends S3Image {
  // Additional gallery-specific properties can be added here
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
  console.log(`🖼️ [GALLERY SERVICE] getGalleryImages called:`, {
    bucket,
    folder,
    maxImages,
    timestamp: new Date().toISOString()
  });
  
  try {
    console.log(`📋 [GALLERY SERVICE] Listing objects in bucket: ${bucket}, folder: ${folder}`);
    const objects = await s3Service.listObjects(bucket, folder, maxImages);
    
    if (!objects || objects.length === 0) {
      console.log(`⚠️ [GALLERY SERVICE] No objects found in bucket: ${bucket}, folder: ${folder}`);
      return {
        bucket,
        folder,
        images: [],
        count: 0
      };
    }

    console.log(`📦 [GALLERY SERVICE] Found ${objects.length} objects, filtering for images...`);
    
    // Filter for image files and sort by last modified
    const imageObjects = s3Service.filterImageFiles(objects);
    
    console.log(`🖼️ [GALLERY SERVICE] Filtered to ${imageObjects.length} image objects`);
    
    // Generate presigned URLs for all images to avoid CORS issues
    console.log(`🔗 [GALLERY SERVICE] Generating presigned URLs for ${imageObjects.length} images...`);
    const images = await Promise.all(
      imageObjects
        .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
        .map(async (obj, index) => {
          const key = obj.Key!;
          console.log(`🔗 [GALLERY SERVICE] Generating presigned URL for image ${index + 1}/${imageObjects.length}: ${key}`);
          
          const presignedUrl = await s3Service.getPresignedUrl(bucket, key, 3600); // 1 hour expiry
          
          const imageData = {
            key,
            url: presignedUrl,
            filename: key.split('/').pop() || '',
            lastModified: obj.LastModified || new Date(),
            size: obj.Size || 0
          };
          
          console.log(`✅ [GALLERY SERVICE] Image ${index + 1} processed:`, {
            key,
            filename: imageData.filename,
            size: imageData.size,
            lastModified: imageData.lastModified,
            urlLength: presignedUrl.length,
            timestamp: new Date().toISOString()
          });
          
          return imageData;
        })
    );

    const result = {
      bucket,
      folder,
      images,
      count: images.length
    };
    
    console.log(`✅ [GALLERY SERVICE] getGalleryImages completed successfully:`, {
      bucket,
      folder,
      totalObjects: objects.length,
      imageCount: images.length,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    console.error(`❌ [GALLERY SERVICE] Error fetching gallery images:`, {
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
  console.log(`🖼️ [GALLERY SERVICE] getHeroImages called`);
  
  if (!S3_BUCKETS.website) {
    console.error(`❌ [GALLERY SERVICE] Website bucket not configured`);
    throw new Error('Website bucket not configured');
  }

  console.log(`🔧 [GALLERY SERVICE] Using website bucket: ${S3_BUCKETS.website}, hero folder: ${S3_FOLDERS.hero}`);
  const result = await getGalleryImages(S3_BUCKETS.website, S3_FOLDERS.hero);
  
  console.log(`✅ [GALLERY SERVICE] getHeroImages completed:`, {
    bucket: S3_BUCKETS.website,
    folder: S3_FOLDERS.hero,
    imageCount: result.count,
    timestamp: new Date().toISOString()
  });
  
  return result.images;
}

/**
 * Get gallery carousel images
 */
export async function getEventImages(): Promise<GalleryImage[]> {
  console.log(`🖼️ [GALLERY SERVICE] getEventImages called`);
  
  if (!S3_BUCKETS.website) {
    console.error(`❌ [GALLERY SERVICE] Website bucket not configured`);
    throw new Error('Website bucket not configured');
  }

  console.log(`🔧 [GALLERY SERVICE] Using website bucket: ${S3_BUCKETS.website}, events folder: ${S3_FOLDERS.events}`);
  const result = await getGalleryImages(S3_BUCKETS.website, S3_FOLDERS.events);
  
  console.log(`✅ [GALLERY SERVICE] getEventImages completed:`, {
    bucket: S3_BUCKETS.website,
    folder: S3_FOLDERS.events,
    imageCount: result.count,
    timestamp: new Date().toISOString()
  });
  
  return result.images;
}

/**
 * Get clinic hero images
 */
export async function getClinicHeroImages(): Promise<GalleryImage[]> {
  console.log(`🖼️ [GALLERY SERVICE] getClinicHeroImages called`);
  
  if (!S3_BUCKETS.clinic) {
    console.error(`❌ [GALLERY SERVICE] Clinic bucket not configured`);
    throw new Error('Clinic bucket not configured');
  }

  console.log(`🔧 [GALLERY SERVICE] Using clinic bucket: ${S3_BUCKETS.clinic}, hero folder: ${S3_FOLDERS.hero}`);
  const result = await getGalleryImages(S3_BUCKETS.clinic, S3_FOLDERS.hero);
  
  console.log(`✅ [GALLERY SERVICE] getClinicHeroImages completed:`, {
    bucket: S3_BUCKETS.clinic,
    folder: S3_FOLDERS.hero,
    imageCount: result.count,
    timestamp: new Date().toISOString()
  });
  
  return result.images;
} 