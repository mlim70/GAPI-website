import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (for production, consider Redis) TODO
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyGenerator?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
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
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    entry.count++;
    next();
  };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute 