// backend/src/utils/fileUpload.ts
import multer from 'multer';
import { uploadToS3 } from './s3Upload';

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

// Configure multer with comprehensive security limits
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only allow 1 file per request
    fieldSize: 1024 * 1024, // 1MB limit for text fields
    fieldNameSize: 100, // Limit field name size
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

  try {
    const result = await uploadToS3(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder
    );

    return result.url;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}