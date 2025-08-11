// Configuration for URLs used throughout the application
export const FRONTEND_URLS = {
  development: 'http://localhost:5173',
  production: process.env.CLIENT_URL
} as const;

export function getFrontendUrl(): string {
  console.log('🔧 getFrontendUrl called with:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    FRONTEND_URLS
  });

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CLIENT_URL) {
      throw new Error('CLIENT_URL environment variable is required in production');
    }
    if (!process.env.CLIENT_URL.trim()) {
      throw new Error('CLIENT_URL environment variable cannot be empty in production');
    }
    
    const url = process.env.CLIENT_URL;
    console.log('🔧 Using CLIENT_URL for production:', url);
    return url;
  }
  
  console.log('🔧 Using development URL:', FRONTEND_URLS.development);
  return FRONTEND_URLS.development;
} 