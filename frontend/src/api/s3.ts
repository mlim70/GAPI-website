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
  const startTime = Date.now();
  console.log(`🔍 [FRONTEND S3 API] fetchS3Image called:`, {
    bucket,
    key,
    apiUrl: env.apiUrl,
    timestamp: new Date().toISOString()
  });
  
  try {
    const url = `${env.apiUrl}/s3/${bucket}/${encodeURIComponent(key)}`;
    console.log(`📡 [FRONTEND S3 API] Making request to: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`📡 [FRONTEND S3 API] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️ [FRONTEND S3 API] Image not found (404): ${bucket}/${key}`);
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`📄 [FRONTEND S3 API] Parsing JSON response...`);
    const result = await response.json();
    
    console.log(`📄 [FRONTEND S3 API] JSON response parsed:`, {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : [],
      timestamp: new Date().toISOString()
    });
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch S3 image');
    }
    
    console.log(`✅ [FRONTEND S3 API] fetchS3Image completed successfully:`, {
      bucket,
      key,
      filename: result.data.filename,
      size: result.data.size,
      lastModified: result.data.lastModified,
      urlLength: result.data.url?.length || 0,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    return result.data;
  } catch (error) {
    console.error(`❌ [FRONTEND S3 API] fetchS3Image failed:`, {
      bucket,
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

/**
 * Universal function - fetch images from any bucket and folder
 */
export async function fetchS3ImagesFromFolder(bucket: string, folder: string): Promise<S3Image[]> {
  const startTime = Date.now();
  console.log(`🔍 [FRONTEND S3 API] fetchS3ImagesFromFolder called:`, {
    bucket,
    folder,
    apiUrl: env.apiUrl,
    env: env,
    timestamp: new Date().toISOString()
  });
  
  try {
    const url = `${env.apiUrl}/s3/${bucket}/folder/${encodeURIComponent(folder)}`;
    console.log(`📡 [FRONTEND S3 API] Making request to: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`📡 [FRONTEND S3 API] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`📄 [FRONTEND S3 API] Parsing JSON response...`);
    const result = await response.json();
    
    console.log(`📄 [FRONTEND S3 API] JSON response parsed:`, {
      success: result.success,
      hasData: !!result.data,
      hasImages: !!result.data?.images,
      imageCount: result.data?.images?.length || 0,
      timestamp: new Date().toISOString()
    });

    // Log detailed image count information
    const imageData = result.data?.images || [];
    console.log(`🖼️ [FRONTEND S3 API] Image count details:`, {
      bucket,
      folder,
      totalImages: imageData.length,
      imageKeys: imageData.map((img: S3Image) => img.key),
      imageFilenames: imageData.map((img: S3Image) => img.filename),
      timestamp: new Date().toISOString()
    });
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch carousel images');
    }
    
    const images = result.data.images || [];
    console.log(`✅ [FRONTEND S3 API] fetchS3ImagesFromFolder completed successfully:`, {
      bucket,
      folder,
      imageCount: images.length,
      images: images.map((img: S3Image) => ({
        key: img.key,
        filename: img.filename,
        size: img.size,
        lastModified: img.lastModified
      })),
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    return images;
  } catch (error) {
    console.error(`❌ [FRONTEND S3 API] fetchS3ImagesFromFolder failed:`, {
      bucket,
      folder,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    return [];
  }
}



 