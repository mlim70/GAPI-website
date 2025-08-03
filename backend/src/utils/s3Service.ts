// backend/src/utils/s3Service.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CONFIG, IMAGE_EXTENSIONS } from './s3Config';

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
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: folder,
      MaxKeys: maxKeys,
    });

    const response = await this.s3Client.send(command);
    return response.Contents || [];
  }

  /**
   * Get a single object from S3
   */
  async getObject(bucket: string, key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await this.s3Client.send(command);
  }

  /**
   * Generate a presigned URL for an object
   */
  async getPresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a direct S3 URL for an object
   */
  generateDirectUrl(bucket: string, key: string, region?: string): string {
    const s3Region = region || S3_CONFIG.region;
    return `https://${bucket}.s3.${s3Region}.amazonaws.com/${key}`;
  }

  /**
   * Filter objects for image files
   */
  filterImageFiles(objects: any[]): any[] {
    return objects.filter(obj => {
      const key = obj.Key || '';
      return IMAGE_EXTENSIONS.test(key) && obj.Size && obj.Size > 0;
    });
  }

  /**
   * Convert S3 object to S3Image interface
   */
  objectToS3Image(obj: any, bucket: string): S3Image {
    const key = obj.Key!;
    return {
      key,
      url: this.generateDirectUrl(bucket, key),
      filename: key.split('/').pop() || '',
      lastModified: obj.LastModified || new Date(),
      size: obj.Size || 0
    };
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
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl || 'public, max-age=86400, immutable',
    });

    await this.s3Client.send(command);
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.s3Client.send(command);
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
    
    await this.uploadObject(bucket, key, file, contentType);
    
    return {
      key,
      url: this.generateDirectUrl(bucket, key),
      bucket,
    };
  }
}

export default S3Service; 