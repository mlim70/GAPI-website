// reCAPTCHA configuration
export const RECAPTCHA_CONFIG = {
  // Site key for reCAPTCHA v3
  SITE_KEY: import.meta.env.VITE_RECAPTCHA_SITE_KEY || '',
  
  // Actions for different operations
  ACTIONS: {
    REGISTRATION: 'registration',
    LOGIN: 'login',
    PASSWORD_RESET: 'password_reset',
    CHECKOUT: 'checkout'
  } as const,
  
  // Score thresholds for different actions
  THRESHOLDS: {
    REGISTRATION: 0.6,    // Higher threshold for registration (more sensitive)
    LOGIN: 0.5,           // Medium threshold for login
    PASSWORD_RESET: 0.5,  // Medium threshold for password reset
    CHECKOUT: 0.5         // Medium threshold for checkout
  } as const
};

// Type for reCAPTCHA actions
export type RecaptchaAction = typeof RECAPTCHA_CONFIG.ACTIONS[keyof typeof RECAPTCHA_CONFIG.ACTIONS];

// Type for reCAPTCHA thresholds
export type RecaptchaThreshold = typeof RECAPTCHA_CONFIG.THRESHOLDS[keyof typeof RECAPTCHA_CONFIG.THRESHOLDS];
