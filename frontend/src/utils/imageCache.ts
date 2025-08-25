// frontend/src/utils/imageCache.ts
import { createCache, CACHE_CONFIG } from './cache';
import { logger } from './logger';

interface CacheConfig {
  prefix: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  prefix: import.meta.env.VITE_CACHE_KEY_PREFIX || 'gapi'
};

export class ImageCache {
  private config: CacheConfig;
  private imageCache = createCache<string, any[]>(CACHE_CONFIG.TTL.IMAGES);
  private singleImageCache = createCache<string, string>(CACHE_CONFIG.TTL.IMAGES);

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached image URLs
   */
  get(key: string): any[] | null {
    const cacheKey = `${this.config.prefix}-${key}`;
    const cachedData = this.imageCache.get(cacheKey);
    
    if (cachedData) {
      logger.debug(`📦 Using cached image URLs for: ${key}`);
      return cachedData;
    }
    
    return null;
  }

  /**
   * Set cached image URLs
   */
  set(key: string, data: any[]): void {
    const cacheKey = `${this.config.prefix}-${key}`;
    this.imageCache.set(cacheKey, data);
    logger.debug(`💾 Cached image URLs for: ${key}`);
  }

  /**
   * Get cached single image URL
   */
  getSingle(key: string): string | null {
    const cacheKey = `${this.config.prefix}-${key}`;
    const cachedData = this.singleImageCache.get(cacheKey);
    
    if (cachedData) {
      logger.debug(`📦 Using cached image URL for: ${key}`);
      return cachedData;
    }
    
    return null;
  }

  /**
   * Set cached single image URL
   */
  setSingle(key: string, data: string): void {
    const cacheKey = `${this.config.prefix}-${key}`;
    this.singleImageCache.set(cacheKey, data);
    logger.debug(`💾 Cached image URL for: ${key}`);
  }

  /**
   * Clear all cached image data
   */
  clearAll(): void {
    this.imageCache.clear();
    this.singleImageCache.clear();
    logger.debug('🗑️ Cleared all cached image data');
  }

  /**
   * Clear cached data for a specific key
   */
  clearKey(key: string): void {
    const cacheKey = `${this.config.prefix}-${key}`;
    this.imageCache.delete(cacheKey);
    this.singleImageCache.delete(cacheKey);
    logger.debug(`🗑️ Cleared cached data for: ${key}`);
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Get cache statistics
   */
  getStats(): { imageCacheSize: number; singleImageCacheSize: number } {
    return {
      imageCacheSize: this.imageCache.size(),
      singleImageCacheSize: this.singleImageCache.size()
    };
  }
}

// Export default instance
export const imageCache = new ImageCache(); 