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
      sponsors: string;
    };
    folders: {
      hero: string;
      gallery: string;
      exec: string;
      sponsors: string;
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
    // In development, use relative path to work with Vite proxy
    apiUrl = '/api';
    console.log('🔧 Development environment detected');
    console.log('🔧 Using relative path for API (Vite proxy):', apiUrl);
  }
  
  const config = {
    apiUrl,
    isProduction,
    isDevelopment,
    s3: {
      buckets: {
        website: import.meta.env.VITE_HOME_BUCKET,
        clinic: import.meta.env.VITE_CLINIC_BUCKET,
        exec: import.meta.env.VITE_EXEC_BUCKET,
        sponsors: import.meta.env.VITE_SPONSORS_BUCKET,
      },
      folders: {
        hero: import.meta.env.VITE_HERO_FOLDER,
        gallery: import.meta.env.VITE_GALLERY_FOLDER,
        exec: import.meta.env.VITE_STUDENTS_RESIDENTS_FOLDER,
        sponsors: import.meta.env.VITE_SPONSORS_FOLDER,
      }
    }
  };
  
  console.log('🔧 Final environment config:', {
    apiUrl: config.apiUrl,
    isProduction: config.isProduction,
    isDevelopment: config.isDevelopment,
    s3: config.s3
  });
  
  return config;
}

export const env = getEnvironmentConfig(); 