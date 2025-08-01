import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function generateSponsorsJson() {
  try {
    const bucketName = process.env.AWS_S3_SPONSOR_BUCKET;
    
    if (!bucketName) {
      console.error('❌ AWS_S3_SPONSOR_BUCKET environment variable not set');
      console.log('💡 Please set AWS_S3_SPONSOR_BUCKET in your .env file');
      process.exit(1);
    }

    console.log(`🔍 Reading contents of bucket: ${bucketName}`);

    // List all objects in the sponsor bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    const listResult = await s3Client.send(listCommand);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log('❌ No objects found in the bucket');
      return;
    }

    console.log(`📁 Found ${listResult.Contents.length} objects in bucket`);

    // Process each object to create sponsor entries
    const sponsorsMetadata: Record<string, { name: string; website?: string }> = {};
    
    for (const object of listResult.Contents) {
      if (!object.Key) continue;
      
      // Skip if it's a directory, hidden file, or the metadata file itself
      if (object.Key.endsWith('/') || object.Key.startsWith('.') || object.Key === 'sponsors.json') continue;
      
      // Extract sponsor name from filename (remove extension)
      const fileName = object.Key.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
      
      // Generate a display name from the filename
      const displayName = nameWithoutExt
        .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
        .join(' ');
      
      // Create sponsor entry
      sponsorsMetadata[nameWithoutExt] = {
        name: displayName,
        website: `https://www.${nameWithoutExt.replace(/[-_]/g, '')}.com` // Generate placeholder website
      };
      
      console.log(`✅ Processed: ${object.Key} -> "${displayName}"`);
    }

    // Generate the JSON content
    const jsonContent = JSON.stringify(sponsorsMetadata, null, 2);
    
    // Write to file
    const outputPath = path.join(__dirname, 'sponsors.json');
    fs.writeFileSync(outputPath, jsonContent);
    
    console.log(`\n📄 Generated sponsors.json with ${Object.keys(sponsorsMetadata).length} sponsors`);
    console.log(`📁 File saved to: ${outputPath}`);
    console.log('\n📋 Next steps:');
    console.log('1. Review the generated sponsors.json file');
    console.log('2. Update the website URLs with actual sponsor websites');
    console.log('3. Upload the file to your S3 bucket');
    console.log('4. The sponsor images will become clickable!');
    
    // Also display the content
    console.log('\n📄 Generated content:');
    console.log(jsonContent);

  } catch (error) {
    console.error('❌ Error reading S3 bucket:', error);
    process.exit(1);
  }
}

// Run the script
generateSponsorsJson(); 