// backend/src/config/recaptcha.ts
export const RECAPTCHA_CONFIG = {
  // Score thresholds for different actions
  THRESHOLDS: {
    REGISTRATION: 0.4,
    LOGIN: 0.4,
    PASSWORD_RESET: 0.3,
    CHECKOUT: 0.3,
    NEWSLETTER_SUBSCRIBE: 0.4,
    CONTACT_FORM: 0.4,
    RESEND_VERIFICATION: 0.4
  } as const,
  
  // Allowed hostnames for reCAPTCHA validation
  ALLOWED_HOSTNAMES: [
    'localhost',
    '127.0.0.1',
    'gapi-website.vercel.app',
    'gapi-website-git-main-gapi-website.vercel.app',
    'gapi-website-git-dev-gapi-website.vercel.app',
    'gapi.org'
  ] as const,
  
  // Actions for different operations
  ACTIONS: {
    REGISTRATION: 'registration',
    LOGIN: 'login',
    PASSWORD_RESET: 'password_reset',
    CHECKOUT: 'checkout',
    NEWSLETTER_SUBSCRIBE: 'newsletter_subscribe',
    CONTACT_FORM: 'contact_form',
    RESEND_VERIFICATION: 'resend_verification'
  } as const
};

// Type for reCAPTCHA thresholds
export type RecaptchaThreshold = typeof RECAPTCHA_CONFIG.THRESHOLDS[keyof typeof RECAPTCHA_CONFIG.THRESHOLDS];

// Type for reCAPTCHA actions
export type RecaptchaAction = typeof RECAPTCHA_CONFIG.ACTIONS[keyof typeof RECAPTCHA_CONFIG.ACTIONS];

// Type for allowed hostnames
export type AllowedHostname = typeof RECAPTCHA_CONFIG.ALLOWED_HOSTNAMES[number];
