// backend/src/config/timezone.ts
import { logger } from '../utils/logger';

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
export function initializeTimezone(): void {
  try {
    // Set timezone to UTC for consistency
    process.env.TZ = 'UTC';
    
    // Verify timezone is set correctly
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset();
    
    if (timezoneOffset === 0) {
      logger.info('🌍 Timezone configuration initialized: UTC timezone set successfully');
    } else {
      logger.warn('⚠️  Warning: Application timezone may not be properly set to UTC');
    }
    
    // Additional timezone validation
    validateTimezone();
    
  } catch (error) {
    logger.error('❌ Failed to initialize timezone configuration:', error);
    throw error;
  }
}

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
function validateTimezone(): void {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset();
  
  if (timezoneOffset !== 0) {
    logger.error('❌ Timezone validation failed: Application is not running in UTC');
    logger.error('   Current timezone offset:', timezoneOffset);
    logger.error('   Expected offset: 0 (UTC)');
    
    // In production, this should be a critical error
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Timezone validation failed: Expected UTC, got offset ${timezoneOffset}`);
    }
  }
}
