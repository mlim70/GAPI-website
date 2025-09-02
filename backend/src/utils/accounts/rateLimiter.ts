// backend/src/utils/accounts/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { normalizeEmail } from '../email/emailUtils';
import { createCache, CACHE_CONFIG } from '../general/cache';
import { logger } from '../general/logger';

/**
 * Extract the real client IP address from request
 * Uses Express's secure proxy trust configuration instead of raw headers
 */
export function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

type RateLimitStrategy = 'ip' | 'user' | 'email' | 'custom';

// Use shared cache utility with configured TTL
const rateLimitStore = createCache<string, RateLimitEntry>(CACHE_CONFIG.TTL.RATE_LIMIT);

// Validate cache TTL is sufficient for largest rate limit windows
const LARGEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes (largest window used in the app)
if (CACHE_CONFIG.TTL.RATE_LIMIT < LARGEST_WINDOW_MS) {
  logger.warn('⚠️ RATE_LIMIT cache TTL is shorter than largest rate limit window', {
    cacheTTL: CACHE_CONFIG.TTL.RATE_LIMIT,
    largestWindow: LARGEST_WINDOW_MS,
    recommendation: 'Increase CACHE_CONFIG.TTL.RATE_LIMIT to at least ' + LARGEST_WINDOW_MS
  });
}

/**
 * Creates a rate limiter middleware with strategy-based key generation
 * @param maxRequests - Maximum requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @param strategy - Rate limiting strategy: 'ip', 'user', 'email', or 'custom'
 * @param customKeyGenerator - Custom key generation function (only used with 'custom' strategy)
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  strategy: RateLimitStrategy = 'ip',
  customKeyGenerator?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = generateRateLimitKey(req, strategy, customKeyGenerator);
    const now = Date.now();
    
    const entry = rateLimitStore.get(key);
    
    // Add debug logging for rate limiting
    logger.debug('Rate limiter check:', {
      key,
      strategy,
      maxRequests,
      windowMs,
      currentCount: entry?.count || 0,
      resetTime: entry?.resetTime,
      timeUntilReset: entry ? Math.ceil((entry.resetTime - now) / 1000) : 'N/A',
      isExpired: entry ? now > entry.resetTime : true
    });
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired - create new entry
      const newEntry = {
        count: 1,
        resetTime: now + windowMs
      };
      
      // Set in cache with longer TTL to ensure it persists through the rate limit window
      rateLimitStore.set(key, newEntry);
      
      logger.debug('Rate limit: First request or window expired, allowing request', {
        newCount: newEntry.count,
        newResetTime: newEntry.resetTime,
        timeUntilReset: Math.ceil(windowMs / 1000)
      });
      return next();
    }
    
    if (entry.count >= maxRequests) {
      const secs = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      logger.warn('Rate limit exceeded:', {
        key,
        strategy,
        currentCount: entry.count,
        maxRequests,
        timeUntilReset: secs
      });
      // Set modern rate limit headers for better client/CDN integration
      res.set({
        'Retry-After': String(secs),
        'RateLimit-Limit': String(maxRequests),
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': String(secs)
      });
      
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter: secs,
        limit: maxRequests,
        window: Math.ceil(windowMs / 1000)
      });
    }
    
    // Increment count
    entry.count++;
    
    // Update the cache entry
    rateLimitStore.update(key, entry);
    
    // Set rate limit headers for successful requests
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSecs = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    
    res.set({
      'RateLimit-Limit': String(maxRequests),
      'RateLimit-Remaining': String(remaining),
      'RateLimit-Reset': String(resetSecs)
    });
    
    logger.debug('Rate limit: Request allowed, count increased to:', entry.count);
    next();
  };
}

/**
 * Reset the rate limit store (useful for testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get the current rate limit store (useful for testing)
 */
export function getRateLimitStore(): Map<string, RateLimitEntry> {
  // Note: The shared cache utility doesn't expose internal entries for security
  // This function returns an empty map as the cache utility handles cleanup internally
  return new Map();
}

/**
 * Get rate limit statistics for debugging
 */
export function getRateLimitStats(): {
  cacheSize: number;
  cacheMaxKeys: number;
  cacheTTL: number;
} {
  return {
    cacheSize: rateLimitStore.size(),
    cacheMaxKeys: 500, // From CACHE_CONFIG.MAX_KEYS
    cacheTTL: CACHE_CONFIG.TTL.RATE_LIMIT
  };
}

/**
 * Generate rate limit key based on strategy
 */
function generateRateLimitKey(
  req: Request, 
  strategy: RateLimitStrategy, 
  customKeyGenerator?: (req: Request) => string
): string {
  switch (strategy) {
    case 'user':
      return generateUserKey(req);
    case 'email':
      return generateEmailKey(req);
    case 'custom':
      return customKeyGenerator ? customKeyGenerator(req) : generateIPKey(req);
    case 'ip':
    default:
      return generateIPKey(req);
  }
}

/**
 * Generate user-based key from stable user identifier
 * Uses req.userId set by requireAuth middleware
 */
function generateUserKey(req: Request): string {
  const userId = (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }
  
  // This should not happen since 'user' strategy is only used with requireAuth middleware
  logger.warn('Rate limiting: req.userId not found, falling back to IP-based limiting');
  return generateIPKey(req);
}

/**
 * Generate email-based key from request body
 */
function generateEmailKey(req: Request): string {
  if (req.body?.email) {
    return `email:${normalizeEmail(req.body.email)}`;
  }
  return generateIPKey(req);
}

/**
 * Generate IP-based key
 */
function generateIPKey(req: Request): string {
  return `ip:${clientIp(req)}`;
}

// Note: Manual cleanup is no longer needed - the shared cache utility handles this automatically 