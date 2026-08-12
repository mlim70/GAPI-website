// backend/src/config/env.ts
export const requireEnv = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} environment variable is required`);
  return v;
};

// JWT and Authentication
export const JWT_SECRET = requireEnv('JWT_SECRET');
export const NEWSLETTER_JWT_SECRET = requireEnv('NEWSLETTER_JWT_SECRET');

// Stripe
export const STRIPE_SECRET_KEY = requireEnv('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET');
export const STRIPE_SPONSOR_PRODUCT_ID = process.env.STRIPE_SPONSOR_PRODUCT_ID;

// Database
export const MONGODB_URI = requireEnv('MONGODB_URI');

// Email Services
export const SENDER_API_KEY = requireEnv('SENDER_API_KEY');
export const SENDER_DOMAIN = requireEnv('SENDER_DOMAIN');
export const SENDER_LIST_ID = requireEnv('SENDER_LIST_ID');
export const SENDER_TX_VERIFICATION_ID = requireEnv('SENDER_TX_VERIFICATION_ID');
export const SENDER_TX_WELCOME_ID = requireEnv('SENDER_TX_WELCOME_ID');
export const SENDER_TX_PASSWORD_RESET_ID = requireEnv('SENDER_TX_PASSWORD_RESET_ID');
export const SENDER_TX_ACCOUNT_DELETION_ID = requireEnv('SENDER_TX_ACCOUNT_DELETION_ID');
export const SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID = requireEnv('SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID');
export const SENDER_TX_CONTACT_FORM_ID = requireEnv('SENDER_TX_CONTACT_FORM_ID');
export const SENDER_TX_CONTACT_FORM_CONFIRMATION_ID = requireEnv('SENDER_TX_CONTACT_FORM_CONFIRMATION_ID');
export const SENDER_TX_MIGRATION_PASSWORD_INVITE_ID = process.env.SENDER_TX_MIGRATION_PASSWORD_INVITE_ID; // optional — legacy migration only
export const CONTACT_EMAIL = requireEnv('CONTACT_EMAIL');



// reCAPTCHA
export const RECAPTCHA_SECRET_KEY = requireEnv('RECAPTCHA_SECRET_KEY');
export const RECAPTCHA_TEST_BYPASS_TOKEN = process.env.RECAPTCHA_TEST_BYPASS_TOKEN;

// Other
export const CLIENT_URL = requireEnv('CLIENT_URL');