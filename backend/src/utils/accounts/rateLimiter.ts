// backend/src/utils/accounts/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { normalizeEmail } from '../email/emailUtils';
import { createCache, CACHE_CONFIG } from '../cache';

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
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        limit: maxRequests,
        window: Math.ceil(windowMs / 1000)
      });
    }
    
    entry.count++;
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