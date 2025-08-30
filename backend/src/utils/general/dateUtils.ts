// backend/src/utils/dateUtils.ts

/**
 * Utility functions for consistent UTC date handling
 * This ensures all dates are handled in UTC to avoid timezone issues
 */

/**
 * Creates a UTC date object
 * @param hoursFromNow - Number of hours to add to current time (default: 0)
 * @returns Date object in UTC
 */
export const createUTCDate = (hoursFromNow: number = 0): Date => {
  const utcDate = new Date();
  if (hoursFromNow > 0) {
    utcDate.setUTCHours(utcDate.getUTCHours() + hoursFromNow);
  }
  return utcDate;
};

/**
 * Gets current time in UTC as ISO string
 * @returns ISO string in UTC
 */
export const getCurrentUTCISO = (): string => {
  return new Date().toISOString();
};
