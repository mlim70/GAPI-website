// backend/src/utils/avatarService.ts
import S3Service, { UploadResult } from './s3Service';
import { S3_BUCKETS, S3_FOLDERS } from './s3Config';

const s3Service = S3Service.getInstance();

export interface AvatarUploadResult {
  key: string;
  url: string;
  bucket: string;
}

/**
 * Upload user avatar to S3
 */
export async function uploadAvatar(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<AvatarUploadResult> {
  if (!S3_BUCKETS.avatar) {
    throw new Error('Avatar bucket not configured');
  }

  try {
    const result = await s3Service.uploadFile(
      S3_BUCKETS.avatar,
      file,
      filename,
      contentType,
      S3_FOLDERS.avatars
    );
    
    console.log('Avatar upload successful, URL:', result.url);
    return result;
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw new Error(`Failed to upload avatar to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete user avatar from S3
 */
export async function deleteAvatar(key: string): Promise<void> {
  if (!S3_BUCKETS.avatar) {
    throw new Error('Avatar bucket not configured');
  }

  try {
    await s3Service.deleteObject(S3_BUCKETS.avatar, key);
    console.log('Avatar deleted successfully:', key);
  } catch (error) {
    console.error('Avatar delete error:', error);
    throw new Error(`Failed to delete avatar from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract S3 key from avatar URL
 */
export function getAvatarKeyFromUrl(url: string): string | null {
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