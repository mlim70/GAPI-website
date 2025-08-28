// backend/src/utils/aws/sponsorService.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../logger';
import { S3_BUCKETS } from './s3Config';
import S3Service from './s3Service';

const s3Service = S3Service.getInstance();

export interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

export interface SponsorMetadata {
  name: string;
  website?: string;
}

/**
 * Get all sponsors from S3 bucket
 */
export async function getSponsors(): Promise<Sponsor[]> {
  const bucketName = S3_BUCKETS.sponsor;
  
  if (!bucketName) {
    throw new Error('Sponsor bucket not configured');
  }

  try {
    // First, try to get sponsors metadata file
    let sponsorsMetadata: Record<string, SponsorMetadata> = {};
    try {
      const metadataResponse = await s3Service.getObject(bucketName, 'sponsors.json');
      
      const metadataContent = await metadataResponse.Body?.transformToString();
      if (metadataContent) {
        sponsorsMetadata = JSON.parse(metadataContent);
      }
    } catch (error) {
      logger.info('No sponsors.json metadata file found.');
    }

    // List all objects in the sponsor bucket
    const objects = await s3Service.listObjects(bucketName);
    
    if (!objects || objects.length === 0) {
      return [];
    }

    // Process each object to create sponsor entries
    const sponsors: Sponsor[] = [];
    
    for (const object of objects) {
      if (!object.Key) continue;
      
      // Skip if it's a directory, hidden file, or the metadata file itself
      if (object.Key.endsWith('/') || object.Key.startsWith('.') || object.Key === 'sponsors.json') continue;
      
      // Generate presigned URL for the image (valid for 1 hour)
      const presignedUrl = await s3Service.getPresignedUrl(bucketName, object.Key, 3600);
      
      // Extract sponsor name from filename (remove extension)
      const fileName = object.Key.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
      
      // Use metadata if available, otherwise use filename
      const metadata = sponsorsMetadata[nameWithoutExt] || sponsorsMetadata[object.Key];
      const displayName = metadata?.name || nameWithoutExt.replace(/[-_]/g, ' ');
      
      // Create sponsor object
      const sponsor: Sponsor = {
        id: object.Key,
        name: displayName,
        logo: presignedUrl,
        website: metadata?.website,
      };
      
      sponsors.push(sponsor);
    }

    return sponsors;
  } catch (error) {
    logger.error('Error fetching sponsors from S3:', error);
    throw new Error(`Failed to fetch sponsors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 