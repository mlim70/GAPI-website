// frontend/src/utils/imageCache.ts

interface CacheConfig {
  ttl: number;
  prefix: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: parseInt(import.meta.env.VITE_IMAGE_CACHE_TTL || '3600000'), // 1 hour default
  prefix: import.meta.env.VITE_CACHE_KEY_PREFIX || 'gapi'
};

export class ImageCache {
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached image URLs
   */
  get(key: string): any[] | null {
    const cacheKey = `${this.config.prefix}-${key}`;
    const timestampKey = `${this.config.prefix}-${key}-ts`;
    
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTs = parseInt(localStorage.getItem(timestampKey) || '0', 10);
    
    if (cachedData && Date.now() - cachedTs < this.config.ttl) {
      console.log(`📦 Using cached image URLs for: ${key}`);
      return JSON.parse(cachedData);
    }
    
    return null;
  }

  /**
   * Set cached image URLs
   */
  set(key: string, data: any[]): void {
    const cacheKey = `${this.config.prefix}-${key}`;
    const timestampKey = `${this.config.prefix}-${key}-ts`;
    
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(timestampKey, Date.now().toString());
    console.log(`💾 Cached image URLs for: ${key}`);
  }

  /**
   * Get cached single image URL
   */
  getSingle(key: string): string | null {
    const cacheKey = `${this.config.prefix}-${key}`;
    const timestampKey = `${this.config.prefix}-${key}-ts`;
    
    const cachedUrl = localStorage.getItem(cacheKey);
    const cachedTs = parseInt(localStorage.getItem(timestampKey) || '0', 10);
    
    if (cachedUrl && Date.now() - cachedTs < this.config.ttl) {
      console.log(`📦 Using cached image URL for: ${key}`);
      return cachedUrl;
    }
    
    return null;
  }

  /**
   * Set cached single image URL
   */
  setSingle(key: string, url: string): void {
    const cacheKey = `${this.config.prefix}-${key}`;
    const timestampKey = `${this.config.prefix}-${key}-ts`;
    
    localStorage.setItem(cacheKey, url);
    localStorage.setItem(timestampKey, Date.now().toString());
    console.log(`💾 Cached image URL for: ${key}`);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.config.prefix)) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ Cleared all cached image data');
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

// Export default instance
export const imageCache = new ImageCache(); 