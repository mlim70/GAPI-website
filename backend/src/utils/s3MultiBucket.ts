// backend/src/utils/s3MultiBucket.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

// Bucket configurations for different carousel types
const BUCKET_CONFIGS = {
  heroCarousel: {
    bucket: process.env.AWS_S3_HERO_BUCKET,
    folder: '',
    region: process.env.AWS_REGION || 'us-east-1'
  },
  eventCarousel: {
    bucket: 'gapi-in-action-images', // Use the bucket with your 6 images
    folder: '',
    region: process.env.AWS_REGION || 'us-east-1'
  },
  clinicCarousel: {
    bucket: process.env.AWS_S3_CLINIC_BUCKET,
    folder: '',
    region: process.env.AWS_REGION || 'us-east-1'
  }
};

export interface CarouselImage {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

export type CarouselType = 'heroCarousel' | 'eventCarousel' | 'clinicCarousel';

/**
 * Get images from a specific S3 bucket and folder
 */
export async function getCarouselImages(carouselType: CarouselType): Promise<CarouselImage[]> {
  const config = BUCKET_CONFIGS[carouselType];
  
  console.log(`🔍 Fetching images for ${carouselType}:`, config);
  
  if (!config.bucket) {
    console.warn(`No bucket configured for ${carouselType}`);
    return [];
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.folder || undefined, // Don't use folder prefix if empty
      MaxKeys: 50, // Limit to 50 images per carousel
    });

    console.log(`📡 Sending S3 ListObjects command to bucket: ${config.bucket}`);
    const response = await s3Client.send(command);
    
    console.log(`📦 S3 Response:`, {
      hasContents: !!response.Contents,
      contentsLength: response.Contents?.length || 0,
      isTruncated: response.IsTruncated,
      maxKeys: response.MaxKeys
    });
    
    if (!response.Contents) {
      return [];
    }

    // Filter for image files and sort by last modified
    const images = response.Contents
      .filter(obj => {
        const key = obj.Key || '';
        return key.match(/\.(jpg|jpeg|png|gif|webp)$/i) && obj.Size && obj.Size > 0;
      })
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
      .map(obj => ({
        key: obj.Key!,
        url: `https://${config.bucket}.s3.${config.region}.amazonaws.com/${obj.Key}`,
        filename: obj.Key!.split('/').pop() || '',
        lastModified: obj.LastModified || new Date(),
        size: obj.Size || 0
      }));

    return images;
  } catch (error) {
    console.error(`❌ Error fetching images for ${carouselType}:`, error);
    console.error(`🔍 Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown error type',
      code: (error as any)?.$metadata?.httpStatusCode,
      requestId: (error as any)?.$metadata?.requestId,
      bucket: config.bucket,
      region: config.region
    });
    return [];
  }
}

/**
 * Get a specific image by key
 */
export async function getImageByKey(carouselType: CarouselType, key: string): Promise<CarouselImage | null> {
  const config = BUCKET_CONFIGS[carouselType];
  
  if (!config.bucket) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return null;
    }

    return {
      key,
      url: `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`,
      filename: key.split('/').pop() || '',
      lastModified: response.LastModified || new Date(),
      size: response.ContentLength || 0
    };
  } catch (error) {
    console.error(`Error fetching image ${key} for ${carouselType}:`, error);
    return null;
  }
}

/**
 * Get bucket configuration for a carousel type
 */
export function getBucketConfig(carouselType: CarouselType) {
  return BUCKET_CONFIGS[carouselType];
} 