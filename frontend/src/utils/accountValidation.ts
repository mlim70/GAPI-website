// frontend/src/utils/accountValidation.ts
import TokenManager from './tokenManager.js';
import { env } from '../config/environment';
import { logger } from './logger';

export interface AccountValidationResult {
  isValid: boolean;
  error?: string;
  shouldRedirect?: boolean;
  redirectUrl?: string;
}

/**
 * Validates that the current user's account is still active and valid
 * This prevents users from proceeding with operations on deleted/deactivated accounts
 */
export async function validateAccountStatus(): Promise<AccountValidationResult> {
  try {
    const token = TokenManager.getToken();
    if (!token) {
      return {
        isValid: false,
        error: 'No authentication token found',
        shouldRedirect: true,
        redirectUrl: '/auth/login'
      };
    }

    // Check account status by making a request to the profile endpoint
    const response = await fetch(`${env.apiUrl}/account/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      return {
        isValid: false,
        error: 'Authentication token expired or invalid',
        shouldRedirect: true,
        redirectUrl: '/auth/login'
      };
    }

    if (response.status === 404) {
      return {
        isValid: false,
        error: 'Account not found or has been deactivated',
        shouldRedirect: true,
        redirectUrl: '/home'
      };
    }

    if (response.status === 403) {
      return {
        isValid: false,
        error: 'Account access denied',
        shouldRedirect: true,
        redirectUrl: '/auth/login'
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        error: 'Failed to validate account status',
        shouldRedirect: true,
        redirectUrl: '/auth/login'
      };
    }

    // Account is valid
    return {
      isValid: true
    };

  } catch (error) {
    logger.error('Error validating account status:', error);
    return {
      isValid: false,
      error: 'Network error while validating account',
      shouldRedirect: true,
      redirectUrl: '/auth/login'
    };
  }
}

/**
 * Clears invalid user data and redirects to the appropriate page
 */
export function handleInvalidAccount(redirectUrl: string = '/auth/login'): void {
  // Clear user data
  TokenManager.logout();
  
  // Clear any additional local storage
  localStorage.removeItem('user');
  
  // Redirect
  window.location.href = redirectUrl;
}

/**
 * Wrapper function to validate account before proceeding with sensitive operations
 * Automatically handles redirects for invalid accounts
 */
export async function withAccountValidation<T>(
  operation: () => Promise<T>,
  fallback?: () => void
): Promise<T | null> {
  const validation = await validateAccountStatus();
  
  if (!validation.isValid) {
    if (validation.shouldRedirect && validation.redirectUrl) {
      handleInvalidAccount(validation.redirectUrl);
      return null;
    }
    
    if (fallback) {
      fallback();
      return null;
    }
    
    throw new Error(validation.error || 'Account validation failed');
  }
  
  return operation();
}
