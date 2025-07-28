// backend/src/utils/s3Upload.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const BUCKET_REGION = process.env.AWS_REGION || 'us-east-1';

if (!BUCKET_NAME) {
  throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: string = 'avatars'
): Promise<UploadResult> {
  const key = `${folder}/${Date.now()}-${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read',
    CacheControl: 'max-age=31536000', // 1 year cache
  });

  try {
    await s3Client.send(command);
    
    const url = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${key}`;
    
    return {
      key,
      url,
      bucket: BUCKET_NAME,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error('S3 delete error:', error);
    // Don't throw error for delete failures - file might not exist
  }
}

/**
 * Generate a presigned URL for direct upload (if needed in the future)
 */
export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Extract S3 key from URL
 */
export function getS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('s3.amazonaws.com') || urlObj.hostname.includes('.s3.')) {
      // Remove leading slash and return the key
      return urlObj.pathname.substring(1);
    }
    return null;
  } catch {
    return null;
  }
} 