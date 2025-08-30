// backend/src/utils/general/cache.ts

// Shared cache configuration
export const CACHE_CONFIG = {
  VERSION: 'v4', // Bump this when cache structure changes
  TTL: {
    NEWSLETTER_HTML: 10 * 60 * 1000, // 10 minutes
    RAW_CAMPAIGNS: 2 * 60 * 60 * 1000,   // 2 hours
    PROCESSED_RESULTS: 10 * 60 * 1000, // 10 minutes
    PREVIEW: 10 * 60 * 1000, // 10 minutes (for campaign previews)
    RATE_LIMIT: 30 * 60 * 1000,       // 30 minutes
    IMAGES: 60 * 60 * 1000,      // 1 hour (aligned with frontend)
    USER_PREFERENCES: 24 * 60 * 60 * 1000, // 24 hours (aligned with frontend)
    API_RESPONSES: 5 * 60 * 1000, // 5 minutes (aligned with frontend)
  },
  MAX_KEYS: 500,
} as const;

// Generic cache with TTL and size limits
export class Cache<K, V> {
  private cache = new Map<K, { data: V; expires: number }>();
  private readonly ttl: number;
  private readonly maxKeys: number;

  constructor(ttl: number, maxKeys: number = CACHE_CONFIG.MAX_KEYS) {
    this.ttl = ttl;
    this.maxKeys = maxKeys;
  }

  set(key: K, value: V): void {
    // Clean up expired entries first
    this.cleanup();
    
    // Prevent unbounded growth
    if (this.cache.size >= this.maxKeys) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data: value,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Update an existing cache entry
   */
  update(key: K, value: V): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Update the data but keep the original expiration time
    entry.data = value;
    return true;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Helper function to create a cache with standard TTL
export function createCache<K, V>(ttl: number): Cache<K, V> {
  return new Cache<K, V>(ttl);
}
