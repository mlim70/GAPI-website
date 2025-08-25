// frontend/src/utils/cache.ts

// Frontend cache configuration
export const CACHE_CONFIG = {
  VERSION: 'v4', // Bump this when cache structure changes
  TTL: {
    IMAGES: 60 * 60 * 1000, // 1 hour
    USER_PREFERENCES: 24 * 60 * 60 * 1000, // 24 hours
    API_RESPONSES: 5 * 60 * 1000, // 5 minutes
    // Additional keys for consistency with backend
    NEWSLETTER_HTML: 10 * 60 * 1000, // 10 minutes
    RAW_CAMPAIGNS: 2 * 60 * 60 * 1000, // 2 hours
    PROCESSED_RESULTS: 10 * 60 * 1000, // 10 minutes
    RATE_LIMIT: 15 * 60 * 60 * 1000, // 15 minutes
  },
  MAX_KEYS: 100, // Smaller limit for frontend memory management
} as const;

// Generic cache with TTL and size limits for frontend use
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
