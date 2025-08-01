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
 * Formats a date string to a readable format
 */
export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
  UNPAID: 'UNPAID',
  TRIAL: 'TRIAL',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS]; 
