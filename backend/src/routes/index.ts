// backend/src/routes/index.ts

// Authentication and account routes
export { default as authRouter } from './auth';
export { default as accountRouter } from './account';
export { default as billingPortalRouter } from './billingPortal';

// Payment and subscription routes
export { default as stripeCheckoutRouter } from '../lib/stripe/checkout';
export { default as stripeWebhookRouter } from '../lib/stripe/webhooks';
export { default as membershipLevelsRouter } from './membershipLevels';
export { default as sponsorCheckoutRouter } from './stripeCheckout';

// Cache monitoring routes removed - not needed for production

// Content and communication routes
export { default as newsletterRouter } from './newsletter';
export { default as newsletterReaderRouter } from './newsletterReader';
export { default as contactRouter } from './contact';
export { default as emailActionsRouter } from './emailActions';

// Media and storage routes
export { default as s3Router } from './s3';
export { default as sponsorsRouter } from './sponsors';
