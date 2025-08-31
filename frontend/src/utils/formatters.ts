// frontend/src/utils/formatters.ts

/**
 * Formats a price from cents to currency string
 */
export const formatPrice = (unitAmount: number, currency: string, interval?: string, intervalCount?: number) => {
  const amount = unitAmount / 100; // Convert cents to dollars
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
  
  if (interval && intervalCount) {
    const intervalText = intervalCount > 1 ? `${intervalCount} ${interval}s` : interval;
    return `${formattedAmount}/${intervalText}`;
  }
  
  return formattedAmount;
};

/**
 * Formats currency from cents
 */
export const formatCurrency = (cents: number, currency: string) => {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

/**
 * Formats a date string to a readable format with timezone
 */
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(date);
};

/**
 * Formats a date string to include time and timezone
 */
export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(date);
};

/**
 * Formats a date string to show only time with timezone
 */
export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(date);
};

/**
 * Formats a date string for news display (date only, no timezone)
 * Used for news articles and announcements where timezone is not relevant
 */
export const formatNewsDate = (dateString: string) => {
  const date = new Date(dateString);
  
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  
  return formattedDate;
};

/**
 * Formats a date string to show date with timezone abbreviation
 * For cases where timezone information is needed
 */
export const formatDateWithTimezone = (dateString: string) => {
  const date = new Date(dateString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneAbbr = getTimezoneAbbreviation(timeZone);
  
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  
  return `${formattedDate} (${timeZoneAbbr})`;
};

/**
 * Gets timezone abbreviation from timezone name
 */
const getTimezoneAbbreviation = (timeZone: string): string => {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    timeZoneName: 'short',
  };
  
  try {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch {
    // Fallback to timezone name if abbreviation fails
    return timeZone;
  }
};

/**
 * Formats billing interval text
 */
export const formatBillingInterval = (isRecurring: boolean, interval?: string, intervalCount?: number) => {
  if (!isRecurring) {
    return 'one-time payment';
  }
  
  if (interval && intervalCount) {
    const intervalText = intervalCount > 1 ? `${intervalCount} ${interval}s` : interval;
    return `per ${intervalText}`;
  }
  
  return 'recurring payment';
};

/**
 * Formats membership level name for display
 */
export const formatMembershipLevelName = (key: string, name?: string) => {
  return name || key.replace(/_/g, ' ');
};

/**
 * Subscription status constants
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS]; 
