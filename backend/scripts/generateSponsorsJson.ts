import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/utils/logger';
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_SPONSOR_BUCKET
} from '../src/config/env';

console.log(`🚀 [SPONSOR SCRIPT] Starting sponsor JSON generation script`);
console.log(`🔧 [SPONSOR SCRIPT] Environment configuration:`, {
  hasRegion: !!AWS_REGION,
  hasAccessKey: !!AWS_ACCESS_KEY_ID,
  hasSecretKey: !!AWS_SECRET_ACCESS_KEY,
  hasSponsorBucket: !!AWS_S3_SPONSOR_BUCKET,
  timestamp: new Date().toISOString()
});

// Initialize S3 client
console.log(`🔧 [SPONSOR SCRIPT] Initializing S3 client...`);
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
console.log(`✅ [SPONSOR SCRIPT] S3 client initialized successfully`);

async function generateSponsorsJson() {
  const startTime = Date.now();
  logger.info('generateSponsorsJson function started');
  
  try {
    const bucketName = process.env.AWS_S3_SPONSOR_BUCKET;
    if (!bucketName) {
      throw new Error('AWS_S3_SPONSOR_BUCKET environment variable is required');
    }

    logger.debug('Reading contents of bucket:', bucketName);
    
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000
    });
    logger.debug('Creating ListObjectsV2Command...');
    
    logger.debug('Sending ListObjectsV2Command to S3...');
    const listResult = await s3Client.send(command);
    
    logger.debug('S3 response received:', {
      hasContents: !!listResult.Contents,
      contentsLength: listResult.Contents?.length || 0,
      isTruncated: listResult.IsTruncated
    });

    if (!listResult.Contents || listResult.Contents.length === 0) {
      logger.warn('No objects found in the bucket');
      return;
    }

    logger.info('Found objects in bucket:', listResult.Contents.length);
    
    logger.debug('Processing objects...');
    const sponsorsMetadata: Record<string, any> = {};

    for (let i = 0; i < listResult.Contents.length; i++) {
      const object = listResult.Contents[i];
      
      if (!object.Key) {
        logger.warn('Object has no key, skipping');
        continue;
      }

      logger.debug('Processing object:', {
        index: i + 1,
        total: listResult.Contents.length,
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified
      });

      // Skip directories, hidden files, and metadata files
      if (object.Key.endsWith('/') || object.Key.startsWith('.') || object.Key.includes('metadata')) {
        logger.debug('Skipping object (directory/hidden/metadata file):', object.Key);
        continue;
      }

      // Extract filename and create display name
      const fileName = object.Key.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      
      logger.debug('Extracted filename:', { fileName, nameWithoutExt });

      // Generate a more readable display name
      let displayName = nameWithoutExt
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
        .trim();

      logger.debug('Generated display name:', { original: nameWithoutExt, display: displayName });

      // Add to sponsors metadata
      sponsorsMetadata[object.Key] = {
        name: displayName,
        filename: fileName,
        url: `https://${bucketName}.s3.amazonaws.com/${object.Key}`,
        size: object.Size || 0,
        lastModified: object.LastModified?.toISOString() || new Date().toISOString()
      };

      logger.debug('Processed:', { key: object.Key, displayName });
    }

    logger.info('Processing complete. Generated sponsor entries:', Object.keys(sponsorsMetadata).length);

    // Generate JSON content
    logger.debug('Generating JSON content...');
    const jsonContent = JSON.stringify(sponsorsMetadata, null, 2);
    
    // Write to file
    const outputPath = join(__dirname, 'sponsors.json');
    logger.debug('Writing to file:', outputPath);
    writeFileSync(outputPath, jsonContent, 'utf8');
    
    logger.info('Generated sponsors.json with sponsors:', Object.keys(sponsorsMetadata).length);
    logger.info('File saved to:', outputPath);
    logger.info('Total processing time:', `${Date.now() - startTime}ms`);
    
    logger.info('Next steps:');
    logger.info('1. Review the generated sponsors.json file');
    logger.info('2. Update the website URLs with actual sponsor websites');
    logger.info('3. Upload the file to your S3 bucket');
    logger.info('4. The sponsor images will become clickable!');
    
    logger.info('Generated content:', jsonContent);
    
  } catch (error) {
    logger.error('Error reading S3 bucket:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Execute the function
logger.info('Executing generateSponsorsJson...');
generateSponsorsJson().catch(console.error); 