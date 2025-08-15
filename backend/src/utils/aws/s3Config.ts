// backend/src/utils/s3Config.ts
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_SPONSOR_BUCKET,
  AWS_S3_HOME_BUCKET,
  AWS_S3_CLINIC_BUCKET,
  AWS_S3_EXEC_BUCKET,
  AWS_S3_HERO_FOLDER,
  AWS_S3_GALLERY_FOLDER,
  AWS_S3_EXEC_FOLDER
} from '../../config/env';

// Lazy loading functions for environment variables
function getS3Config() {
  return {
    region: AWS_REGION,
    hasCredentials: !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY),
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  };
}

function getS3Buckets() {
  return {
    sponsor: AWS_S3_SPONSOR_BUCKET,
    website: AWS_S3_HOME_BUCKET,
    clinic: AWS_S3_CLINIC_BUCKET,
    exec: AWS_S3_EXEC_BUCKET,
  };
}

function getS3Folders() {
  return {
    hero: AWS_S3_HERO_FOLDER,
    events: AWS_S3_GALLERY_FOLDER,
    gallery: AWS_S3_GALLERY_FOLDER,
    exec: AWS_S3_EXEC_FOLDER,
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