// frontend/src/api/s3.ts
import { env } from '../config/environment';

export interface S3Image {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

/**
 * Fetch a static image from any S3 bucket
 */
export async function fetchS3Image(bucket: string, key: string): Promise<S3Image | null> {
  try {
    const response = await fetch(`${env.apiUrl}/s3/${bucket}/${encodeURIComponent(key)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch S3 image');
    }
    
    return result.data;
  } catch (error) {
    console.error(`Error fetching S3 image ${key} from bucket ${bucket}:`, error);
    return null;
  }
}

/**
 * Universal function - fetch images from any bucket and folder
 */
export async function fetchS3ImagesFromFolder(bucket: string, folder: string): Promise<S3Image[]> {
  try {
    const response = await fetch(`${env.apiUrl}/s3/${bucket}/folder/${encodeURIComponent(folder)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch carousel images');
    }
    
    return result.data.images;
  } catch (error) {
    console.error(`Error fetching carousel images from bucket ${bucket}, folder ${folder}:`, error);
    return [];
  }
}



 