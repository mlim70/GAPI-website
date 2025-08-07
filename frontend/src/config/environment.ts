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
  
  // In production, use the VITE_API_URL or construct from current domain
  let apiUrl: string;
  
  if (isProduction) {
    // If VITE_API_URL is set, use it
    if (import.meta.env.VITE_API_URL) {
      apiUrl = import.meta.env.VITE_API_URL;
    } else {
      // Otherwise, construct from current domain
      const currentOrigin = window.location.origin;
      apiUrl = `${currentOrigin}/api`;
    }
  } else {
    // In development, use localhost
    apiUrl = 'http://localhost:4000/api';
  }
  
  return {
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
}

export const env = getEnvironmentConfig(); 