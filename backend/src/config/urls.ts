// Configuration for URLs used throughout the application

// Lazy loading function for production URL
function getProductionUrl(): string {
  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl) {
    throw new Error('CLIENT_URL environment variable is required in production');
  }
  if (!clientUrl.trim()) {
    throw new Error('CLIENT_URL environment variable cannot be empty in production');
  }
  return clientUrl;
}

export const FRONTEND_URLS = {
  development: 'http://localhost:5173',
  get production() { return getProductionUrl(); }
} as const;

export function getFrontendUrl(): string {
  console.log('🔧 getFrontendUrl called with:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    FRONTEND_URLS
  });

  if (process.env.NODE_ENV === 'production') {
    const url = getProductionUrl();
    console.log('🔧 Using CLIENT_URL for production:', url);
    return url;
  }
  
  console.log('🔧 Using development URL:', FRONTEND_URLS.development);
  return FRONTEND_URLS.development;
} 