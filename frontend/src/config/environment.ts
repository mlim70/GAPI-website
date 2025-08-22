// frontend/src/config/environment.ts
export const getEnvironmentConfig = () => {
  // Get the current origin
  const origin = window.location.origin;
  
  // Default API URL (relative path for Vite proxy)
  let apiUrl = '/api';
  
  // Check if we have a specific API URL from environment
  if (import.meta.env.VITE_API_URL) {
    apiUrl = import.meta.env.VITE_API_URL;
  } else {
    // Auto-detect based on environment
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      // Development environment
      apiUrl = '/api';
    } else {
      // Production environment
      apiUrl = `${origin}/api`;
    }
  }
  
  return {
    apiUrl,
    origin,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD
  };
};

// Export the API URL for direct use
export const API_URL = getEnvironmentConfig().apiUrl;

// Export env object for components that expect it
export const env = {
  apiUrl: getEnvironmentConfig().apiUrl
}; 