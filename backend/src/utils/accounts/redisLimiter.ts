// backend/src/utils/accounts/redisLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../general/redisUpstash';
import { logger } from '../general/logger';
import { normalizeEmail } from '../email/emailUtils';
import { normalizeUsername } from './usernameUtils';
import isEmail from 'validator/lib/isEmail.js';

// Environment-based namespacing to avoid key collisions
const NS = process.env.REDIS_NAMESPACE || process.env.NODE_ENV || 'dev';
const nsKey = (s: string) => `${NS}:${s}`;

// Log the namespace being used for debugging
logger.info('Redis rate limiter namespace:', { 
  namespace: NS, 
  source: process.env.REDIS_NAMESPACE ? 'REDIS_NAMESPACE' : process.env.NODE_ENV ? 'NODE_ENV' : 'default' 
});

/**
 * Extract the real client IP address from request
 * Uses Express's secure proxy trust configuration
 */
function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Creates a Redis-based rate limiter middleware
 * Falls back gracefully to allowing requests if Redis is unavailable
 */
export function createRedisRateLimiter(
  max: number, 
  windowMs: number, 
  keygen: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keygen(req);
    
    try {
      // Use Redis INCR + PEXPIRE for atomic-enough fixed window rate limiting
      const count = await redis.incr(key);
      
      // Set expiration only on first increment (count === 1)
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (count > max) {
        // Get remaining TTL for Retry-After header
        const ttlMs = await redis.pttl(key);
        const secs = Math.max(1, Math.ceil((ttlMs ?? windowMs) / 1000));
        
        logger.warn('Redis rate limit exceeded:', {
          key,
          count,
          max,
          ttlSeconds: secs
        });
        
        // Set modern rate limit headers for better client/CDN integration
        res.set({
          'Retry-After': String(secs),
          'RateLimit-Limit': String(max),
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': String(secs)
        });
        
        return res.status(429).json({
          message: 'Too many requests. Please try again later.',
          retryAfter: secs,
          limit: max,
          window: Math.ceil(windowMs / 1000)
        });
      }

      // Set rate limit headers for successful requests too
      const remaining = Math.max(0, max - count);
      const ttlMs = await redis.pttl(key);
      const resetSecs = Math.max(1, Math.ceil((ttlMs ?? windowMs) / 1000));
      
      res.set({
        'RateLimit-Limit': String(max),
        'RateLimit-Remaining': String(remaining),
        'RateLimit-Reset': String(resetSecs)
      });

      logger.debug('Redis rate limit check passed:', {
        key,
        count,
        max,
        remaining,
        resetInSeconds: resetSecs
      });
      
      next();
    } catch (error) {
      // Graceful degradation: log error but allow request through
      logger.warn('Redis rate limiter error, allowing request:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
        fallbackBehavior: 'allow_request'
      });
      next();
    }
  };
}

// Pre-built key generators for common strategies

/**
 * IP-based key generator
 */
export const ipKey = (req: Request): string => nsKey(`rl:ip:${clientIp(req)}`);

/**
 * User-based key generator (requires req.userId to be set by auth middleware)
 */
export const userKey = (req: Request): string => {
  const userId = (req as any).userId;
  if (!userId) {
    logger.warn('User-based rate limiting requested but req.userId not found, falling back to IP');
    return ipKey(req);
  }
  return nsKey(`rl:user:${userId}`);
};

/**
 * Email-based key generator (from request body)
 */
export const emailKey = (req: Request): string => {
  const email = req.body?.email;
  if (!email) {
    logger.warn('Email-based rate limiting requested but email not found in body, falling back to IP');
    return ipKey(req);
  }
  return nsKey(`rl:email:${normalizeEmail(email)}`);
};

/**
 * Identifier-based key generator (email or username from request body)
 * Useful for login endpoints that accept either email or username
 */
export const identifierKey = (req: Request): string => {
  const identifier = req.body?.identifier || req.body?.email || req.body?.username;
  if (!identifier) {
    logger.warn('Identifier-based rate limiting requested but identifier not found, falling back to IP');
    return ipKey(req);
  }
  
  const normalized = isEmail(identifier) 
    ? normalizeEmail(identifier) 
    : normalizeUsername(identifier);
  return nsKey(`rl:id:${normalized}`);
};

/**
 * Custom key generator that combines IP and email for registration
 * Prevents both IP-based and email-based abuse
 */
export const registrationKey = (req: Request): string => {
  const email = req.body?.email;
  const ip = clientIp(req);
  if (!email) {
    return nsKey(`rl:reg:ip:${ip}`);
  }
  return nsKey(`rl:reg:${ip}:${normalizeEmail(email)}`);
};
