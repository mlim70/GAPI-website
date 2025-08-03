// frontend/src/api/s3.ts

export interface S3Image {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Fetch a static image from any S3 bucket
 */
export async function fetchS3Image(bucket: string, key: string): Promise<S3Image | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/s3/${bucket}/${encodeURIComponent(key)}`);
    
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