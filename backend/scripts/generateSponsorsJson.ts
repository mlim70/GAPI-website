import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
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
  console.log(`🔄 [SPONSOR SCRIPT] generateSponsorsJson function started`);
  
  try {
    const bucketName = AWS_S3_SPONSOR_BUCKET;

    console.log(`🔍 [SPONSOR SCRIPT] Reading contents of bucket: ${bucketName}`);

    // List all objects in the sponsor bucket
    console.log(`📋 [SPONSOR SCRIPT] Creating ListObjectsV2Command...`);
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    console.log(`📤 [SPONSOR SCRIPT] Sending ListObjectsV2Command to S3...`);
    const listResult = await s3Client.send(listCommand);
    
    console.log(`📦 [SPONSOR SCRIPT] S3 response received:`, {
      hasContents: !!listResult.Contents,
      contentsLength: listResult.Contents?.length || 0,
      isTruncated: listResult.IsTruncated,
      hasNextToken: !!listResult.NextContinuationToken,
      timestamp: new Date().toISOString()
    });
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log('❌ [SPONSOR SCRIPT] No objects found in the bucket');
      return;
    }

    console.log(`📁 [SPONSOR SCRIPT] Found ${listResult.Contents.length} objects in bucket`);

    // Process each object to create sponsor entries
    console.log(`🔄 [SPONSOR SCRIPT] Processing ${listResult.Contents.length} objects...`);
    const sponsorsMetadata: Record<string, { name: string; website?: string }> = {};
    
    for (let i = 0; i < listResult.Contents.length; i++) {
      const object = listResult.Contents[i];
      if (!object.Key) {
        console.log(`⚠️ [SPONSOR SCRIPT] Object ${i + 1} has no key, skipping`);
        continue;
      }
      
      console.log(`🔍 [SPONSOR SCRIPT] Processing object ${i + 1}/${listResult.Contents.length}:`, {
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified,
        timestamp: new Date().toISOString()
      });
      
      // Skip if it's a directory, hidden file, or the metadata file itself
      if (object.Key.endsWith('/') || object.Key.startsWith('.') || object.Key === 'sponsors.json') {
        console.log(`⏭️ [SPONSOR SCRIPT] Skipping ${object.Key} (directory/hidden/metadata file)`);
        continue;
      }
      
      // Extract sponsor name from filename (remove extension)
      const fileName = object.Key.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
      
      console.log(`🔧 [SPONSOR SCRIPT] Extracted filename: ${fileName} -> name: ${nameWithoutExt}`);
      
      // Generate a display name from the filename
      const displayName = nameWithoutExt
        .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
        .join(' ');
      
      console.log(`✨ [SPONSOR SCRIPT] Generated display name: "${nameWithoutExt}" -> "${displayName}"`);
      
      // Create sponsor entry
      sponsorsMetadata[nameWithoutExt] = {
        name: displayName,
        website: `https://www.${nameWithoutExt.replace(/[-_]/g, '')}.com` // Generate placeholder website
      };
      
      console.log(`✅ [SPONSOR SCRIPT] Processed: ${object.Key} -> "${displayName}"`);
    }

    console.log(`📊 [SPONSOR SCRIPT] Processing complete. Generated ${Object.keys(sponsorsMetadata).length} sponsor entries`);

    // Generate the JSON content
    console.log(`📄 [SPONSOR SCRIPT] Generating JSON content...`);
    const jsonContent = JSON.stringify(sponsorsMetadata, null, 2);
    
    // Write to file
    const outputPath = path.join(__dirname, 'sponsors.json');
    console.log(`💾 [SPONSOR SCRIPT] Writing to file: ${outputPath}`);
    fs.writeFileSync(outputPath, jsonContent);
    
    console.log(`\n📄 [SPONSOR SCRIPT] Generated sponsors.json with ${Object.keys(sponsorsMetadata).length} sponsors`);
    console.log(`📁 [SPONSOR SCRIPT] File saved to: ${outputPath}`);
    console.log(`⏱️ [SPONSOR SCRIPT] Total processing time: ${Date.now() - startTime}ms`);
    console.log('\n📋 [SPONSOR SCRIPT] Next steps:');
    console.log('1. Review the generated sponsors.json file');
    console.log('2. Update the website URLs with actual sponsor websites');
    console.log('3. Upload the file to your S3 bucket');
    console.log('4. The sponsor images will become clickable!');
    
    // Also display the content
    console.log('\n📄 [SPONSOR SCRIPT] Generated content:');
    console.log(jsonContent);

  } catch (error) {
    console.error('❌ [SPONSOR SCRIPT] Error reading S3 bucket:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

// Run the script
console.log(`🚀 [SPONSOR SCRIPT] Executing generateSponsorsJson...`);
generateSponsorsJson(); 