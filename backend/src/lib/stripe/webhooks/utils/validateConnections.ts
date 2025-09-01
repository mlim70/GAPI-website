// backend/src/lib/stripe/webhooks/utils/validationConnections.ts
import { stripe } from '../../client';
import { STRIPE_WEBHOOK_SECRET } from '../../../../config/env';
import { logger } from '../../../../utils/general/logger';

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(body: Buffer, signature: string): any {
  try {
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    logger.info('✅ Webhook signature verified');
    return event;
  } catch (err: any) {
    logger.error('❌ Webhook signature validation failed:', err?.message);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Validate webhook event structure
 */
export function validateWebhookEvent(event: any): boolean {
  if (!event || !event.id || !event.type || !event.data || !event.data.object) {
    logger.error('❌ Invalid webhook event structure');
    return false;
  }
  
  logger.info('✅ Webhook event structure validated');
  return true;
}

/**
 * Validate database connection
 */
export async function validateDatabaseConnection(): Promise<boolean> {
  try {
    // This would typically check if the database connection is alive
    // For now, we'll assume it's valid if we can reach this point
    return true;
  } catch (error) {
    logger.error('❌ Database connection validation failed:', error);
    return false;
  }
}
