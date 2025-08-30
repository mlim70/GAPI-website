// backend/src/config/urls.ts
import { CLIENT_URL } from './env';
import { logger } from '../utils/general/logger';

// Lazy loading function for production URL
function getProductionUrl(): string {
  if (!CLIENT_URL) {
    throw new Error('CLIENT_URL environment variable is required in production');
  }
  if (!CLIENT_URL.trim()) {
    throw new Error('CLIENT_URL environment variable cannot be empty in production');
  }
  return CLIENT_URL;
}

export const FRONTEND_URLS = {
  development: 'http://localhost:5173',
  get production() { return getProductionUrl(); }
} as const;

export function getFrontendUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    const url = getProductionUrl();
    logger.debug('🔧 Using CLIENT_URL for production:', url);
    return url;
  }
  
  logger.debug('🔧 Using development URL:', FRONTEND_URLS.development);
  return FRONTEND_URLS.development;
} 