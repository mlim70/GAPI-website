// backend/src/utils/stripe/cache.ts
import { Cache, createCache } from '../general/cache';
import { logger } from '../general/logger';

// Cache TTL: 15 minutes for prices and products
const PRICE_CACHE_TTL = 15 * 60 * 1000; // 5 minutes
const PRODUCT_CACHE_TTL = 15 * 60 * 1000; // 10 minutes

// Cache instances
const priceCache = createCache<string, CachedPrice>(PRICE_CACHE_TTL);
const productCache = createCache<string, CachedProduct>(PRODUCT_CACHE_TTL);

// Cached data types - only cache essential fields to reduce memory usage
export interface CachedPrice {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring?: {
    interval: string;
    interval_count: number;
  };
  product: string; // product ID
}

export interface CachedProduct {
  id: string;
  active: boolean;
  name: string;
  description: string | null;
}

/**
 * Get cached price data or return undefined if not cached/expired
 */
export function getCachedPrice(priceId: string): CachedPrice | undefined {
  return priceCache.get(priceId);
}

/**
 * Get cached product data or return undefined if not cached/expired
 */
export function getCachedProduct(productId: string): CachedProduct | undefined {
  return productCache.get(productId);
}

/**
 * Cache price data
 */
export function cachePrice(priceId: string, priceData: CachedPrice): void {
  priceCache.set(priceId, priceData);
  logger.debug('Cached price data:', { priceId, active: priceData.active });
}

/**
 * Cache product data
 */
export function cacheProduct(productId: string, productData: CachedProduct): void {
  productCache.set(productId, productData);
  logger.debug('Cached product data:', { productId, active: productData.active });
}

/**
 * Invalidate price cache entry
 */
export function invalidatePrice(priceId: string): void {
  const deleted = priceCache.delete(priceId);
  if (deleted) {
    logger.info('Invalidated price cache:', priceId);
  }
}

/**
 * Invalidate product cache entry
 */
export function invalidateProduct(productId: string): void {
  const deleted = productCache.delete(productId);
  if (deleted) {
    logger.info('Invalidated product cache:', productId);
  }
}

/**
 * Invalidate all price and product caches
 */
export function invalidateAllStripeCache(): void {
  priceCache.clear();
  productCache.clear();
  logger.info('Cleared all Stripe caches');
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    priceCacheSize: priceCache.size(),
    productCacheSize: productCache.size(),
    priceCacheTTL: PRICE_CACHE_TTL,
    productCacheTTL: PRODUCT_CACHE_TTL
  };
}
