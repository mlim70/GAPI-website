import { Router } from 'express';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = Router();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

// GET /api/sponsors - Fetch all sponsors from S3 bucket
router.get('/', async (req, res) => {
  try {
    const bucketName = process.env.AWS_S3_SPONSOR_BUCKET;
    
    if (!bucketName) {
      console.error('AWS_S3_SPONSOR_BUCKET environment variable not set');
      return res.status(500).json({ error: 'Sponsor bucket configuration missing' });
    }

    // First, try to get sponsors metadata file
    let sponsorsMetadata: Record<string, { name: string; website?: string }> = {};
    try {
      const metadataCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'sponsors.json',
      });
      
      const metadataResponse = await s3Client.send(metadataCommand);
      const metadataContent = await metadataResponse.Body?.transformToString();
      if (metadataContent) {
        sponsorsMetadata = JSON.parse(metadataContent);
      }
    } catch (error) {
      console.log('No sponsors.json metadata file found.');
    }

    // List all objects in the sponsor bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    const listResult = await s3Client.send(listCommand);
    
    if (!listResult.Contents) {
      return res.json([]);
    }

    // Process each object to create sponsor entries
    const sponsors: Sponsor[] = [];
    
    for (const object of listResult.Contents) {
      if (!object.Key) continue;
      
      // Skip if it's a directory, hidden file, or the metadata file itself
      if (object.Key.endsWith('/') || object.Key.startsWith('.') || object.Key === 'sponsors.json') continue;
      
      // Generate presigned URL for the image (valid for 1 hour)
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: object.Key,
      });
      
      const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
      
      // Extract sponsor name from filename (remove extension)
      const fileName = object.Key.split('/').pop() || '';
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
      
      // Use metadata if available, otherwise use filename
      const metadata = sponsorsMetadata[nameWithoutExt] || sponsorsMetadata[object.Key];
      const displayName = metadata?.name || nameWithoutExt.replace(/[-_]/g, ' ');
      
      // Create sponsor object
      const sponsor: Sponsor = {
        id: object.Key,
        name: displayName,
        logo: presignedUrl,
        website: metadata?.website,
      };
      
      sponsors.push(sponsor);
    }

    res.json(sponsors);
  } catch (error) {
    console.error('Error fetching sponsors from S3:', error);
    res.status(500).json({ error: 'Failed to fetch sponsors' });
  }
});

export default router; 