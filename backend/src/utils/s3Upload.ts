// backend/src/utils/s3Upload.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const BUCKET_NAME = process.env.AWS_S3_AVATAR_BUCKET;
const BUCKET_REGION = process.env.AWS_REGION || 'us-east-1';

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
    CacheControl: 'public, max-age=86400, immutable', // 24 hours, immutable
  });

  try {
    await s3Client.send(command);
    
    const url = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${key}`;
    console.log('S3 upload successful, URL:', url);
    
    return {
      key,
      url,
      bucket: BUCKET_NAME,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    console.error('S3 error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown error type',
      code: (error as any)?.$metadata?.httpStatusCode,
      requestId: (error as any)?.$metadata?.requestId
    });
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  // If bucket name is not available, just return (mock behavior)
  if (!BUCKET_NAME) {
    return;
  }

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