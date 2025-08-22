// backend/src/utils/s3Service.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CONFIG, IMAGE_EXTENSIONS } from './s3Config';
import { createUTCDate } from '../dateUtils';

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
    console.log(`🔧 [S3 SERVICE] Initializing S3Service with config:`, {
      hasRegion: !!config?.region,
      hasAccessKey: !!config?.accessKeyId,
      hasSecretKey: !!config?.secretAccessKey,
      defaultRegion: S3_CONFIG.region,
      defaultHasCredentials: S3_CONFIG.hasCredentials,
      timestamp: new Date().toISOString()
    });
    
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
    
    console.log(`✅ [S3 SERVICE] S3Client initialized successfully`);
  }

  static getInstance(config?: S3ServiceConfig): S3Service {
    if (!S3Service.instance) {
      console.log(`🔄 [S3 SERVICE] Creating new S3Service instance`);
      S3Service.instance = new S3Service(config);
    } else {
      console.log(`♻️ [S3 SERVICE] Returning existing S3Service instance`);
    }
    return S3Service.instance;
  }

  /**
   * Get the S3 client instance
   */
  getClient(): S3Client {
    console.log(`🔧 [S3 SERVICE] getClient() called`);
    return this.s3Client;
  }

  /**
   * List objects in a bucket with optional folder prefix
   */
  async listObjects(bucket: string, folder?: string, maxKeys: number = 50): Promise<any[]> {
    const startTime = Date.now();
    console.log(`📋 [S3 SERVICE] listObjects called:`, {
      bucket,
      folder: folder || 'root',
      maxKeys,
      timestamp: new Date().toISOString()
    });
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: folder ? (folder.endsWith('/') ? folder : `${folder}/`) : undefined,
        MaxKeys: maxKeys,
      });

      console.log(`📤 [S3 SERVICE] Sending ListObjectsV2Command to S3...`);
      const response = await this.s3Client.send(command);
      
      const objectCount = response.Contents?.length || 0;
      console.log(`✅ [S3 SERVICE] listObjects completed successfully:`, {
        bucket,
        folder: folder || 'root',
        objectCount,
        hasMore: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken ? 'present' : 'none',
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      return response.Contents || [];
    } catch (error) {
      console.error(`❌ [S3 SERVICE] listObjects failed:`, {
        bucket,
        folder: folder || 'root',
        maxKeys,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get a single object from S3
   */
  async getObject(bucket: string, key: string): Promise<any> {
    const startTime = Date.now();
    console.log(`📥 [S3 SERVICE] getObject called:`, {
      bucket,
      key,
      timestamp: new Date().toISOString()
    });
    
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      console.log(`📤 [S3 SERVICE] Sending GetObjectCommand to S3...`);
      const response = await this.s3Client.send(command);
      
      console.log(`✅ [S3 SERVICE] getObject completed successfully:`, {
        bucket,
        key,
        hasBody: !!response.Body,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      console.error(`❌ [S3 SERVICE] getObject failed:`, {
        bucket,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Generate a presigned URL for an object
   */
  async getPresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    const startTime = Date.now();
    console.log(`🔗 [S3 SERVICE] getPresignedUrl called:`, {
      bucket,
      key,
      expiresIn,
      timestamp: new Date().toISOString()
    });
    
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      console.log(`🔗 [S3 SERVICE] Generating presigned URL...`);
      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      console.log(`✅ [S3 SERVICE] getPresignedUrl completed successfully:`, {
        bucket,
        key,
        expiresIn,
        urlLength: presignedUrl.length,
        urlPreview: presignedUrl.substring(0, 100) + '...',
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });

      return presignedUrl;
    } catch (error) {
      console.error(`❌ [S3 SERVICE] getPresignedUrl failed:`, {
        bucket,
        key,
        expiresIn,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Generate a direct S3 URL for an object
   */
  generateDirectUrl(bucket: string, key: string, region?: string): string {
    const s3Region = region || S3_CONFIG.region;
    const url = `https://${bucket}.s3.${s3Region}.amazonaws.com/${key}`;
    
    console.log(`🔗 [S3 SERVICE] generateDirectUrl called:`, {
      bucket,
      key,
      region: s3Region,
      generatedUrl: url,
      timestamp: new Date().toISOString()
    });
    
    return url;
  }

  /**
   * Generate a presigned URL for an object (alternative to direct URL)
   */
  async generatePresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    console.log(`🔗 [S3 SERVICE] generatePresignedUrl called (delegating to getPresignedUrl):`, {
      bucket,
      key,
      expiresIn,
      timestamp: new Date().toISOString()
    });
    
    return await this.getPresignedUrl(bucket, key, expiresIn);
  }

  /**
   * Filter objects for image files
   */
  filterImageFiles(objects: any[]): any[] {
    console.log(`🔍 [S3 SERVICE] filterImageFiles called:`, {
      totalObjects: objects.length,
      timestamp: new Date().toISOString()
    });
    
    const filteredObjects = objects.filter(obj => {
      const key = obj.Key || '';
      const isImage = IMAGE_EXTENSIONS.test(key) && obj.Size && obj.Size > 0;
      
      if (isImage) {
        console.log(`✅ [S3 SERVICE] Image file found:`, {
          key,
          size: obj.Size,
          lastModified: obj.LastModified,
          timestamp: new Date().toISOString()
        });
      }
      
      return isImage;
    });
    
    console.log(`✅ [S3 SERVICE] filterImageFiles completed:`, {
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
    
    console.log(`🔄 [S3 SERVICE] objectToS3Image converted:`, {
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
    console.log(`📤 [S3 SERVICE] uploadObject called:`, {
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

      console.log(`📤 [S3 SERVICE] Sending PutObjectCommand to S3...`);
      await this.s3Client.send(command);
      
      console.log(`✅ [S3 SERVICE] uploadObject completed successfully:`, {
        bucket,
        key,
        bodySize: body.length,
        contentType,
        cacheControl: cacheControl || 'default',
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [S3 SERVICE] uploadObject failed:`, {
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
    const startTime = Date.now();
    console.log(`🗑️ [S3 SERVICE] deleteObject called:`, {
      bucket,
      key,
      timestamp: new Date().toISOString()
    });
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      console.log(`🗑️ [S3 SERVICE] Sending DeleteObjectCommand to S3...`);
      await this.s3Client.send(command);
      
      console.log(`✅ [S3 SERVICE] deleteObject completed successfully:`, {
        bucket,
        key,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [S3 SERVICE] deleteObject failed:`, {
        bucket,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
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
    const startTime = Date.now();
    const key = folder ? `${folder}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`;
    
    console.log(`📁 [S3 SERVICE] uploadFile called:`, {
      bucket,
      filename,
      contentType,
      folder: folder || 'root',
      generatedKey: key,
      fileSize: file.length,
      timestamp: new Date().toISOString()
    });
    
    try {
      await this.uploadObject(bucket, key, file, contentType);
      
      const result = {
        key,
        url: this.generateDirectUrl(bucket, key),
        bucket,
      };
      
      console.log(`✅ [S3 SERVICE] uploadFile completed successfully:`, {
        bucket,
        key,
        filename,
        url: result.url,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      console.error(`❌ [S3 SERVICE] uploadFile failed:`, {
        bucket,
        filename,
        folder: folder || 'root',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

export default S3Service; 