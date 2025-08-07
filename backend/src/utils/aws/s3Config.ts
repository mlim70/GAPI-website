// backend/src/utils/s3Config.ts

export const S3_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export const S3_BUCKETS = {
  avatar: process.env.AWS_S3_AVATAR_BUCKET,
  sponsor: process.env.AWS_S3_SPONSOR_BUCKET,
  website: process.env.AWS_S3_HOME_BUCKET,
  clinic: process.env.AWS_S3_CLINIC_BUCKET,
  exec: process.env.AWS_S3_EXEC_BUCKET,
};

export const S3_FOLDERS = {
  avatars: 'avatars',
  hero: process.env.AWS_S3_HERO_FOLDER || 'hero',
  events: process.env.AWS_S3_GALLERY_FOLDER || 'gallery',
  gallery: process.env.AWS_S3_GALLERY_FOLDER || 'gallery',
  exec: process.env.AWS_S3_EXEC_FOLDER || '',
}; 