// backend/src/config/timezone.ts

/**
 * Timezone configuration for the application
 * This ensures all dates are handled consistently in UTC
 */

// Lazy loading function for timezone initialization
function initializeProcessTimezone(): void {
  // Set the timezone environment variable to UTC
  process.env.TZ = 'UTC';
}

/**
 * Timezone configuration object
 */
export const TIMEZONE_CONFIG = {
  // Default timezone for the application
  DEFAULT_TIMEZONE: 'UTC',
  
  // MongoDB timezone (should always be UTC)
  MONGODB_TIMEZONE: 'UTC',
  
  // Date format for logging and display
  DATE_FORMAT: 'ISO',
  
  // Timezone offset in minutes (UTC = 0)
  UTC_OFFSET_MINUTES: 0,
  
  // Timezone offset in hours (UTC = 0)
  UTC_OFFSET_HOURS: 0,
};

/**
 * Initialize timezone configuration
 * This should be called early in the application startup
 */
export const initializeTimezone = (): void => {
  // Initialize process timezone first
  initializeProcessTimezone();
  
  // Ensure process timezone is set to UTC
  process.env.TZ = TIMEZONE_CONFIG.DEFAULT_TIMEZONE;
  
  // Log timezone configuration
  console.log('🌍 Timezone configuration initialized:', {
    processTimezone: process.env.TZ,
    currentDate: new Date().toISOString(),
    utcOffset: new Date().getTimezoneOffset(),
  });
  
  // Verify MongoDB is using UTC
  const now = new Date();
  const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  
  if (Math.abs(now.getTime() - utcNow.getTime()) > 1000) {
    console.warn('⚠️  Warning: Application timezone may not be properly set to UTC');
  }
};

/**
 * Get current timezone information
 */
export const getTimezoneInfo = () => {
  return {
    processTimezone: process.env.TZ,
    currentDate: new Date().toISOString(),
    utcOffset: new Date().getTimezoneOffset(),
    timezoneOffset: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

/**
 * Validate that the application is running in UTC
 */
export const validateUTCTimezone = (): boolean => {
  const now = new Date();
  const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  
  // Allow for small differences due to system clock precision
  const timeDifference = Math.abs(now.getTime() - utcNow.getTime());
  const isValid = timeDifference < 1000; // Less than 1 second difference
  
  if (!isValid) {
    console.error('❌ Timezone validation failed: Application is not running in UTC');
    console.error('   Current timezone offset:', now.getTimezoneOffset());
    console.error('   Expected offset: 0 (UTC)');
  }
  
  return isValid;
};
