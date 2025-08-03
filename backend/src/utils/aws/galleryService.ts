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
  try {
    const objects = await s3Service.listObjects(bucket, folder, maxImages);
    
    if (!objects || objects.length === 0) {
      return {
        bucket,
        folder,
        images: [],
        count: 0
      };
    }

    // Filter for image files and sort by last modified
    const imageObjects = s3Service.filterImageFiles(objects);
    const images = imageObjects
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
      .map(obj => s3Service.objectToS3Image(obj, bucket));

    return {
      bucket,
      folder,
      images,
      count: images.length
    };
  } catch (error) {
    console.error(`Error fetching gallery images from bucket ${bucket}, folder ${folder}:`, error);
    throw new Error(`Failed to fetch gallery images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get hero carousel images
 */
export async function getHeroImages(): Promise<GalleryImage[]> {
  if (!S3_BUCKETS.website) {
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
    throw new Error('Clinic bucket not configured');
  }

  const result = await getGalleryImages(S3_BUCKETS.clinic, S3_FOLDERS.hero);
  return result.images;
} 