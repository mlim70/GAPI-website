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
  const config = {
    region: AWS_REGION,
    hasCredentials: !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY),
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  };
  
  console.log(`🔧 [S3 CONFIG] getS3Config called:`, {
    hasRegion: !!config.region,
    hasCredentials: config.hasCredentials,
    hasAccessKey: !!config.accessKeyId,
    hasSecretKey: !!config.secretAccessKey,
    timestamp: new Date().toISOString()
  });
  
  return config;
}

function getS3Buckets() {
  const buckets = {
    sponsor: AWS_S3_SPONSOR_BUCKET,
    website: AWS_S3_HOME_BUCKET,
    clinic: AWS_S3_CLINIC_BUCKET,
    exec: AWS_S3_EXEC_BUCKET,
  };
  
  console.log(`🔧 [S3 CONFIG] getS3Buckets called:`, {
    hasSponsorBucket: !!buckets.sponsor,
    hasWebsiteBucket: !!buckets.website,
    hasClinicBucket: !!buckets.clinic,
    hasExecBucket: !!buckets.exec,
    timestamp: new Date().toISOString()
  });
  
  return buckets;
}

function getS3Folders() {
  const folders = {
    hero: AWS_S3_HERO_FOLDER,
    events: AWS_S3_GALLERY_FOLDER,
    gallery: AWS_S3_GALLERY_FOLDER,
    exec: AWS_S3_EXEC_FOLDER,
  };
  
  console.log(`🔧 [S3 CONFIG] getS3Folders called:`, {
    hasHeroFolder: !!folders.hero,
    hasEventsFolder: !!folders.events,
    hasGalleryFolder: !!folders.gallery,
    hasExecFolder: !!folders.exec,
    timestamp: new Date().toISOString()
  });
  
  return folders;
}

export const S3_CONFIG = {
  get region() { 
    console.log(`🔧 [S3 CONFIG] S3_CONFIG.region accessed`);
    return getS3Config().region; 
  },
  get hasCredentials() { 
    console.log(`🔧 [S3 CONFIG] S3_CONFIG.hasCredentials accessed`);
    return getS3Config().hasCredentials; 
  },
  get accessKeyId() { 
    console.log(`🔧 [S3 CONFIG] S3_CONFIG.accessKeyId accessed`);
    return getS3Config().accessKeyId; 
  },
  get secretAccessKey() { 
    console.log(`🔧 [S3 CONFIG] S3_CONFIG.secretAccessKey accessed`);
    return getS3Config().secretAccessKey; 
  },
};

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export const S3_BUCKETS = {
  get sponsor() { 
    console.log(`🔧 [S3 CONFIG] S3_BUCKETS.sponsor accessed`);
    return getS3Buckets().sponsor; 
  },
  get website() { 
    console.log(`🔧 [S3 CONFIG] S3_BUCKETS.website accessed`);
    return getS3Buckets().website; 
  },
  get clinic() { 
    console.log(`🔧 [S3 CONFIG] S3_BUCKETS.clinic accessed`);
    return getS3Buckets().clinic; 
  },
  get exec() { 
    console.log(`🔧 [S3 CONFIG] S3_BUCKETS.exec accessed`);
    return getS3Buckets().exec; 
  },
};

export const S3_FOLDERS = {
  get hero() { 
    console.log(`🔧 [S3 CONFIG] S3_FOLDERS.hero accessed`);
    return getS3Folders().hero; 
  },
  get events() { 
    console.log(`🔧 [S3 CONFIG] S3_FOLDERS.events accessed`);
    return getS3Folders().events; 
  },
  get gallery() { 
    console.log(`🔧 [S3 CONFIG] S3_FOLDERS.gallery accessed`);
    return getS3Folders().gallery; 
  },
  get exec() { 
    console.log(`🔧 [S3 CONFIG] S3_FOLDERS.exec accessed`);
    return getS3Folders().exec; 
  },
}; 