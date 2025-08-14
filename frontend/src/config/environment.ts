// frontend/src/config/environment.ts

interface EnvironmentConfig {
  apiUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
  s3: {
    buckets: {
      website: string;
      clinic: string;
      exec: string;
    };
    folders: {
      hero: string;
      events: string;
      gallery: string;
      exec: string;
    };
  };
}

function getEnvironmentConfig(): EnvironmentConfig {
  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;
  
  // Check for environment variable first (for Vercel deployments)
  let apiUrl: string;
  
  if (import.meta.env.VITE_API_URL) {
    // Use environment variable if provided (for Vercel deployments)
    apiUrl = import.meta.env.VITE_API_URL;
    console.log('🔧 Using VITE_API_URL from environment:', apiUrl);
  } else if (isProduction) {
    // Fallback: In production, use the current origin to ensure HTTPS
    let origin: string;
    try {
      origin = window.location.origin;
    } catch (e) {
      // If window.location.origin is not available, use relative path
      origin = '';
      console.log('⚠️ Could not get current origin, using relative path');
    }
    apiUrl = origin ? `${origin}/api` : '/api';
    console.log('🔧 Production environment detected');
    console.log('🔧 Current origin:', origin);
    console.log('🔧 Using origin-based API URL:', apiUrl);
  } else {
    // In development, use localhost
    apiUrl = 'http://localhost:4000/api';
    console.log('🔧 Development environment detected');
    console.log('🔧 Using localhost for API:', apiUrl);
  }
  
  const config = {
    apiUrl,
    isProduction,
    isDevelopment,
    s3: {
      buckets: {
        website: import.meta.env.VITE_HOME_BUCKET || 'gapi-home',
        clinic: import.meta.env.VITE_CLINIC_BUCKET || 'gapi-clinic',
        exec: import.meta.env.VITE_EXEC_BUCKET || 'gapi-exec',
      },
      folders: {
        hero: import.meta.env.VITE_HERO_FOLDER || 'hero',
        events: import.meta.env.VITE_GALLERY_FOLDER || 'gallery',
        gallery: import.meta.env.VITE_GALLERY_FOLDER || 'gallery',
        exec: import.meta.env.VITE_EXEC_FOLDER || '',
      }
    }
  };
  
  console.log('🔧 Final environment config:', {
    apiUrl: config.apiUrl,
    isProduction: config.isProduction,
    isDevelopment: config.isDevelopment
  });
  
  return config;
}

export const env = getEnvironmentConfig(); 