// frontend/src/config/s3.ts
import { logger } from '../utils/logger';

// Export the configuration from the consolidated environment config
export const getS3Buckets = () => {
  logger.debug(`🔧 [FRONTEND S3 CONFIG] getS3Buckets called`);
  
  // Return default bucket configuration
  return {
    website: 'gapi-website',
    clinic: 'gapi-clinic',
    exec: 'gapi-exec'
  };
};

export const getS3Folders = () => {
  logger.debug(`🔧 [FRONTEND S3 CONFIG] getS3Folders called`);
  
  // Return default folder configuration
  return {
    hero: import.meta.env.VITE_HERO_FOLDER,
    gallery: import.meta.env.VITE_GALLERY_FOLDER,
    exec: import.meta.env.VITE_STUDENTS_RESIDENTS_FOLDER
  };
};