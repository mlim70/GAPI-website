// backend/src/utils/stripeUtils.ts
import { stripe } from '../lib/stripe';
import { logger } from './logger';

/**
 * Validates that a Stripe price ID exists and is active
 */
export async function validateStripePrice(priceId: string): Promise<boolean> {
  try {
    logger.debug('Validating Stripe price ID:', priceId);
    const price = await stripe.prices.retrieve(priceId);
    
    if (!price.active) {
      logger.warn('Stripe price is inactive:', priceId);
      return false;
    }
    
    // Validate that the associated product is also active
    // Stripe can mark products inactive while leaving prices around
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (!product.active) {
      logger.warn('Stripe product is inactive:', productId, 'for price:', priceId);
      return false;
    }
    
    logger.debug('Stripe price and product are valid:', { 
      id: price.id, 
      active: price.active, 
      productId: product.id,
      productActive: product.active,
      currency: price.currency,
      unitAmount: price.unit_amount,
      recurring: price.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : 'one-time'
    });
    return true;
  } catch (err: any) {
    logger.warn('Stripe price validation failed:', err.message);
    return false;
  }
}
