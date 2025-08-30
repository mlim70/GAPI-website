// backend/src/services/aws/s3Service.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CONFIG, IMAGE_EXTENSIONS } from './s3Config';
import { createUTCDate } from '../../utils/general/dateUtils';
import { logger } from '../../utils/general/logger';

export interface S3Image {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

export interface S3ServiceConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

class S3Service {
  private static instance: S3Service;
  private s3Client: S3Client;

  private constructor(config?: S3ServiceConfig) {
    this.s3Client = new S3Client({
      region: config?.region || S3_CONFIG.region,
      credentials: config?.accessKeyId ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey!,
      } : S3_CONFIG.hasCredentials ? {
        accessKeyId: S3_CONFIG.accessKeyId!,
        secretAccessKey: S3_CONFIG.secretAccessKey!,
      } : undefined,
    });
  }

  static getInstance(config?: S3ServiceConfig): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service(config);
    }
    return S3Service.instance;
  }

  /**
   * Get the S3 client instance
   */
  getClient(): S3Client {
    return this.s3Client;
  }

  /**
   * List objects in a bucket with optional folder prefix
   */
  async listObjects(bucket: string, folder?: string, maxKeys: number = 50): Promise<any[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: folder ? (folder.endsWith('/') ? folder : `${folder}/`) : undefined,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);
      return response.Contents || [];
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] listObjects failed:`, error);
      throw error;
    }
  }

  /**
   * Get a single object from S3
   */
  async getObject(bucket: string, key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return response;
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] getObject failed:`, error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for an object
   */
  async getPresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return presignedUrl;
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] getPresignedUrl failed:`, error);
      throw error;
    }
  }

  /**
   * Generate a direct S3 URL for an object
   */
  generateDirectUrl(bucket: string, key: string, region?: string): string {
    const s3Region = region || S3_CONFIG.region;
    const url = `https://${bucket}.s3.${s3Region}.amazonaws.com/${key}`;
    return url;
  }

  /**
   * Generate a presigned URL for an object (alternative to direct URL)
   */
  async generatePresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    return await this.getPresignedUrl(bucket, key, expiresIn);
  }

  /**
   * Filter objects for image files
   */
  filterImageFiles(objects: any[]): any[] {
    logger.debug(`🔍 [S3 SERVICE] filterImageFiles called:`, {
      totalObjects: objects.length,
      timestamp: new Date().toISOString()
    });
    
    const filteredObjects = objects.filter(obj => {
      const key = obj.Key || '';
      const isImage = IMAGE_EXTENSIONS.test(key) && obj.Size && obj.Size > 0;
      
      return isImage;
    });
    
    logger.debug(`✅ [S3 SERVICE] filterImageFiles completed:`, {
      totalObjects: objects.length,
      filteredCount: filteredObjects.length,
      timestamp: new Date().toISOString()
    });
    
    return filteredObjects;
  }

  /**
   * Convert S3 object to S3Image interface
   */
  objectToS3Image(obj: any, bucket: string): S3Image {
    const key = obj.Key!;
    const imageData = {
      key,
      url: this.generateDirectUrl(bucket, key),
      filename: key.split('/').pop() || '',
      lastModified: obj.LastModified || createUTCDate(),
      size: obj.Size || 0
    };
    
    logger.debug(`🔄 [S3 SERVICE] objectToS3Image converted:`, {
      originalKey: key,
      bucket,
      filename: imageData.filename,
      size: imageData.size,
      lastModified: imageData.lastModified,
      timestamp: new Date().toISOString()
    });
    
    return imageData;
  }

  /**
   * Upload an object to S3
   */
  async uploadObject(
    bucket: string, 
    key: string, 
    body: Buffer, 
    contentType: string,
    cacheControl?: string
  ): Promise<void> {
    const startTime = Date.now();
    logger.debug(`📤 [S3 SERVICE] uploadObject called:`, {
      bucket,
      key,
      bodySize: body.length,
      contentType,
      cacheControl: cacheControl || 'default',
      timestamp: new Date().toISOString()
    });
    
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl || 'public, max-age=86400, immutable',
      });

      logger.debug(`📤 [S3 SERVICE] Sending PutObjectCommand to S3...`);
      await this.s3Client.send(command);
      
      logger.debug(`✅ [S3 SERVICE] uploadObject completed successfully:`, {
        bucket,
        key,
        bodySize: body.length,
        contentType,
        cacheControl: cacheControl || 'default',
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] uploadObject failed:`, {
        bucket,
        key,
        bodySize: body.length,
        contentType,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] deleteObject failed:`, error);
      throw error;
    }
  }

  /**
   * Upload a file and return the result
   */
  async uploadFile(
    bucket: string,
    file: Buffer,
    filename: string,
    contentType: string,
    folder: string = ''
  ): Promise<UploadResult> {
    const key = folder ? `${folder}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`;
    
    try {
      await this.uploadObject(bucket, key, file, contentType);
      
      const result = {
        key,
        url: this.generateDirectUrl(bucket, key),
        bucket,
      };
      
      return result;
    } catch (error) {
      logger.error(`❌ [S3 SERVICE] uploadFile failed:`, error);
      throw error;
    }
  }
}

export default S3Service; 