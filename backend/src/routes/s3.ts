// backend/src/routes/s3.ts
import express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

export interface S3Image {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

/**
 * GET /api/s3/:bucket/:key(*)
 * Get a static image from any S3 bucket
 */
router.get('/:bucket/:key(*)', async (req, res) => {
  try {
    const { bucket, key } = req.params;
    
    console.log(`🔍 Fetching S3 image: ${key} from bucket: ${bucket}`);
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      console.log(`❌ No body found for S3 image: ${key}`);
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const imageData: S3Image = {
      key,
      url: `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
      filename: key.split('/').pop() || '',
      lastModified: response.LastModified || new Date(),
      size: response.ContentLength || 0
    };

    console.log(`✅ S3 image fetched successfully:`, imageData);
    
    res.json({
      success: true,
      data: imageData
    });
  } catch (error) {
    console.error(`❌ Error fetching S3 image ${req.params.key} from bucket ${req.params.bucket}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image'
    });
  }
});

export default router; 