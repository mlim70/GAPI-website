import 'dotenv/config';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/utils/general/logger';
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_SPONSOR_BUCKET
} from '../src/config/env';

logger.info(`🚀 [SPONSOR SCRIPT] Starting sponsor JSON generation script`);
logger.info(`🔧 [SPONSOR SCRIPT] Environment configuration:`, {
  hasRegion: !!AWS_REGION,
  hasAccessKey: !!AWS_ACCESS_KEY_ID,
  hasSecretKey: !!AWS_SECRET_ACCESS_KEY,
  hasSponsorBucket: !!AWS_S3_SPONSOR_BUCKET,
  timestamp: new Date().toISOString()
});

// Initialize S3 client
logger.info(`🔧 [SPONSOR SCRIPT] Initializing S3 client...`);
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
logger.info(`✅ [SPONSOR SCRIPT] S3 client initialized successfully`);

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

    // Read existing local sponsors.json if it exists to preserve metadata
    const outputPath = join(__dirname, 'sponsors.json');
    let existingData: Record<string, any> = {};
    try {
      const existingContent = require('fs').readFileSync(outputPath, 'utf8');
      existingData = JSON.parse(existingContent);
      logger.info('Loaded existing sponsors.json to preserve metadata (websites, etc.)');
    } catch (e) {
      logger.info('No existing local sponsors.json found or invalid JSON. Creating fresh.');
    }

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

      const existingEntry = existingData[object.Key] || existingData[nameWithoutExt] || {};

      // Add to sponsors metadata
      sponsorsMetadata[object.Key] = {
        name: existingEntry.name || displayName,
        filename: fileName,
        url: `https://${bucketName}.s3.amazonaws.com/${object.Key}`,
        size: object.Size || 0,
        lastModified: object.LastModified?.toISOString() || new Date().toISOString()
      };

      if (existingEntry.website) {
        sponsorsMetadata[object.Key].website = existingEntry.website;
      }

      logger.debug('Processed:', { key: object.Key, displayName });
    }

    logger.info('Processing complete. Generated sponsor entries:', Object.keys(sponsorsMetadata).length);

    // Generate JSON content
    logger.debug('Generating JSON content...');
    const jsonContent = JSON.stringify(sponsorsMetadata, null, 2);
    
    // Write to local file
    logger.debug('Writing to local file:', outputPath);
    writeFileSync(outputPath, jsonContent, 'utf8');
    
    // Upload to S3
    logger.info('📤 Uploading sponsors.json to S3...');
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'sponsors.json',
      Body: jsonContent,
      ContentType: 'application/json'
    });
    
    await s3Client.send(uploadCommand);
    logger.info('✅ sponsors.json successfully uploaded to S3');
    
    logger.info('Generated sponsors.json with sponsors:', Object.keys(sponsorsMetadata).length);
    logger.info('File saved locally to:', outputPath);
    logger.info('File uploaded to S3 bucket:', bucketName);
    logger.info('Total processing time:', `${Date.now() - startTime}ms`);
    
    logger.info('Next steps:');
    logger.info('1. Review the generated sponsors.json file locally');
    logger.info('2. Edit the local file to add website URLs for sponsors');
    logger.info('3. Re-run this script to upload the updated version to S3');
    logger.info('4. The sponsor images will become clickable on your frontend!');
    
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
generateSponsorsJson().catch((error) => logger.error('Script execution failed:', error)); 