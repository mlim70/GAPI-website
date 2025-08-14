// backend/src/utils/s3Config.ts

// Lazy loading functions for environment variables
function getS3Config() {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

function getS3Buckets() {
  return {
    sponsor: process.env.AWS_S3_SPONSOR_BUCKET,
    website: process.env.AWS_S3_HOME_BUCKET,
    clinic: process.env.AWS_S3_CLINIC_BUCKET,
    exec: process.env.AWS_S3_EXEC_BUCKET,
  };
}

function getS3Folders() {
  return {
    hero: process.env.AWS_S3_HERO_FOLDER || 'hero',
    events: process.env.AWS_S3_GALLERY_FOLDER || 'gallery',
    gallery: process.env.AWS_S3_GALLERY_FOLDER || 'gallery',
    exec: process.env.AWS_S3_EXEC_FOLDER || '',
  };
}

export const S3_CONFIG = {
  get region() { return getS3Config().region; },
  get hasCredentials() { return getS3Config().hasCredentials; },
  get accessKeyId() { return getS3Config().accessKeyId; },
  get secretAccessKey() { return getS3Config().secretAccessKey; },
};

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export const S3_BUCKETS = {
  get sponsor() { return getS3Buckets().sponsor; },
  get website() { return getS3Buckets().website; },
  get clinic() { return getS3Buckets().clinic; },
  get exec() { return getS3Buckets().exec; },
};

export const S3_FOLDERS = {
  get hero() { return getS3Folders().hero; },
  get events() { return getS3Folders().events; },
  get gallery() { return getS3Folders().gallery; },
  get exec() { return getS3Folders().exec; },
}; 