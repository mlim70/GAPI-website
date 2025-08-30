// backend/src/utils/accounts/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { normalizeEmail } from '../email/emailUtils';
import { createCache, CACHE_CONFIG } from '../general/cache';
import { logger } from '../general/logger';

/**
 * Extract the real client IP address from request, handling proxies/CDNs
 */
export function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff)) return xff[0].split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

type RateLimitStrategy = 'ip' | 'user' | 'email' | 'custom';

// Use shared cache utility with configured TTL
const rateLimitStore = createCache<string, RateLimitEntry>(CACHE_CONFIG.TTL.RATE_LIMIT);

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
      logger.warn('Rate limit exceeded:', {
        key,
        strategy,
        currentCount: entry.count,
        maxRequests,
        timeUntilReset: Math.ceil((entry.resetTime - now) / 1000)
      });
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        limit: maxRequests,
        window: Math.ceil(windowMs / 1000)
      });
    }
    
    // Increment count
    entry.count++;
    
    // Update the cache entry
    rateLimitStore.update(key, entry);
    
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
 * Generate user-based key from JWT token
 */
function generateUserKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      return `user:${hashString(token)}`;
    } catch (error) {
      // Fall back to IP if token parsing fails
    }
  }
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

/**
 * Simple string hashing function for rate limiting keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Note: Manual cleanup is no longer needed - the shared cache utility handles this automatically 