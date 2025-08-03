// frontend/src/config/s3.ts
import { env } from './environment.js';

// Export the configuration from the consolidated environment config
export const getS3Buckets = () => env.s3.buckets;
export const getS3Folders = () => env.s3.folders;