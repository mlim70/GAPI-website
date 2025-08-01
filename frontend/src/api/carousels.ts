// frontend/src/api/carousels.ts

export interface CarouselImage {
  key: string;
  url: string;
  filename: string;
  lastModified: Date;
  size: number;
}

export interface CarouselData {
  type: string;
  images: CarouselImage[];
  count: number;
}

export interface CarouselSummary {
  type: string;
  count: number;
  lastUpdated: Date | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Fetch images for a specific carousel type
 */
export async function fetchCarouselImages(type: 'heroCarousel' | 'eventCarousel'): Promise<CarouselImage[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/carousels/${type}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch carousel images');
    }
    
    return result.data.images;
  } catch (error) {
    console.error(`Error fetching ${type} images:`, error);
    return [];
  }
}

/**
 * Fetch a specific image by key
 */
export async function fetchCarouselImage(type: 'heroCarousel' | 'eventCarousel', key: string): Promise<CarouselImage | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/carousels/${type}/image/${encodeURIComponent(key)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch image');
    }
    
    return result.data;
  } catch (error) {
    console.error(`Error fetching image ${key} for ${type}:`, error);
    return null;
  }
}

/**
 * Fetch summary of all carousel types
 */
export async function fetchCarouselSummary(): Promise<CarouselSummary[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/carousels`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch carousel summary');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching carousel summary:', error);
    return [];
  }
}

/**
 * Get image URLs for a carousel type (simplified version)
 */
export async function getCarouselImageUrls(type: 'heroCarousel' | 'eventCarousel'): Promise<string[]> {
  const images = await fetchCarouselImages(type);
  return images.map(img => img.url);
} 