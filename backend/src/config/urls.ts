// Configuration for URLs used throughout the application
export const FRONTEND_URLS = {
  development: 'http://localhost:5173',
  production: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
} as const;

export function getFrontendUrl(): string {
  console.log('🔧 getFrontendUrl called with:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    FRONTEND_URLS
  });

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.VERCEL_URL) {
      throw new Error('VERCEL_URL environment variable is not set in production');
    }
    if (!process.env.VERCEL_URL.trim()) {
      throw new Error('VERCEL_URL environment variable is empty in production');
    }
    const url = `https://${process.env.VERCEL_URL}`;
    console.log('🔧 Generated production URL:', url);
    return url;
  }
  
  console.log('🔧 Using development URL:', FRONTEND_URLS.development);
  return FRONTEND_URLS.development;
} 