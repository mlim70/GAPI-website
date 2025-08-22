// frontend/src/config/recaptcha.ts
export const RECAPTCHA_CONFIG = {
  SITE_KEY: import.meta.env.VITE_RECAPTCHA_SITE_KEY || '',
  SECRET_KEY: import.meta.env.VITE_RECAPTCHA_SECRET_KEY || '',
  THRESHOLD: 0.5,
  ACTIONS: {
    REGISTRATION: 'registration',
    LOGIN: 'login',
    RESEND_VERIFICATION: 'resend_verification',
    PASSWORD_RESET: 'password_reset',
    CONTACT_FORM: 'contact_form',
    NEWSLETTER_SUBSCRIBE: 'newsletter_subscribe'
  },
  THRESHOLDS: {
    REGISTRATION: 0.5,
    LOGIN: 0.5,
    RESEND_VERIFICATION: 0.5,
    PASSWORD_RESET: 0.5,
    CONTACT_FORM: 0.5,
    NEWSLETTER_SUBSCRIBE: 0.5
  }
};

// Check if reCAPTCHA is properly configured
export const isRecaptchaConfigured = () => {
  return RECAPTCHA_CONFIG.SITE_KEY && RECAPTCHA_CONFIG.SITE_KEY !== '';
};

// Get reCAPTCHA site key
export const getRecaptchaSiteKey = () => {
  return RECAPTCHA_CONFIG.SITE_KEY;
};
