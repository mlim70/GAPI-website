// backend/src/utils/fileUpload.ts
import multer from 'multer';
import { uploadToS3, deleteFromS3, getS3KeyFromUrl } from './s3Upload.js';

// Configure multer for memory storage (we'll upload to S3)
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

/**
 * Upload file to S3 and return the URL
 */
export async function uploadFileToS3(
  file: Express.Multer.File,
  folder: string = 'avatars'
): Promise<string> {
  if (!file.buffer) {
    throw new Error('No file buffer provided');
  }

  const result = await uploadToS3(
    file.buffer,
    file.originalname,
    file.mimetype,
    folder
  );

  return result.url;
}

/**
 * Delete file from S3 by URL
 */
export async function deleteFileFromS3(url: string): Promise<void> {
  const key = getS3KeyFromUrl(url);
  if (key) {
    await deleteFromS3(key);
  }
}

// Legacy functions for backward compatibility (if needed)
export const getFileUrl = (filename: string): string => {
  console.warn('getFileUrl is deprecated. Use S3 upload instead.');
  return `/uploads/${filename}`;
};

export const deleteFile = (filename: string): void => {
  console.warn('deleteFile is deprecated. Use S3 delete instead.');
  // No-op for local files
}; 