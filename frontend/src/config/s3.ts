// frontend/src/config/s3.ts
import { env } from './environment.js';

// Export the configuration from the consolidated environment config
export const getS3Buckets = () => {
  console.log(`🔧 [FRONTEND S3 CONFIG] getS3Buckets called:`, {
    hasEnv: !!env,
    hasS3: !!env.s3,
    hasBuckets: !!env.s3?.buckets,
    timestamp: new Date().toISOString()
  });
  
  const buckets = env.s3.buckets;
  console.log(`✅ [FRONTEND S3 CONFIG] S3 buckets retrieved:`, {
    bucketKeys: buckets ? Object.keys(buckets) : [],
    timestamp: new Date().toISOString()
  });
  
  return buckets;
};

export const getS3Folders = () => {
  console.log(`🔧 [FRONTEND S3 CONFIG] getS3Folders called:`, {
    hasEnv: !!env,
    hasS3: !!env.s3,
    hasFolders: !!env.s3?.folders,
    timestamp: new Date().toISOString()
  });
  
  const folders = env.s3.folders;
  console.log(`✅ [FRONTEND S3 CONFIG] S3 folders retrieved:`, {
    folderKeys: folders ? Object.keys(folders) : [],
    timestamp: new Date().toISOString()
  });
  
  return folders;
};