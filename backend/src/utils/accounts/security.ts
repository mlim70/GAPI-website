//security.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to enforce HTTPS in production
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    // Check for X-Forwarded-Proto header (common with load balancers)
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    
    if (!isHttps) {
      return res.status(403).json({
        message: 'HTTPS is required in production'
      });
    }
  }
  next();
}

/**
 * Middleware to add security headers
 */
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  // Allow same-origin framing for newsletter reader
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - allow reCAPTCHA while maintaining security
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://www.google.com",
    "frame-src 'self' https://www.google.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  next();
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeError(error: any): string {
  if (process.env.NODE_ENV === 'production') {
    // In production, don't leak internal details
    if (error.code === 'ENOTFOUND') return 'Network error';
    if (error.code === 'ECONNREFUSED') return 'Service temporarily unavailable';
    if (error.name === 'ValidationError') return 'Invalid data provided';
    if (error.name === 'CastError') return 'Invalid identifier';
    return 'An error occurred';
  }
  
  // In development, show more details
  return error.message || 'Unknown error';
} 