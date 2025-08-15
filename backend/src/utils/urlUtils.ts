// backend/src/utils/urlUtils.ts
import { getFrontendUrl } from '../config/urls';

/**
 * Gets the correct base URL for the application
 */
export function getBaseUrl(): string {
  const baseUrl = getFrontendUrl();
  
  console.log('🔗 Generated base URL:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    baseUrl
  });
  
  return baseUrl;
}
