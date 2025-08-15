// backend/src/utils/stripeUtils.ts
import { stripe } from '../lib/stripe';

/**
 * Validates that a Stripe price ID exists and is active
 */
export async function validateStripePrice(priceId: string): Promise<boolean> {
  try {
    console.log('🔍 Validating Stripe price ID:', priceId);
    const price = await stripe.prices.retrieve(priceId);
    
    if (!price.active) {
      console.log('❌ Stripe price is inactive:', priceId);
      return false;
    }
    
    console.log('✅ Stripe price is valid:', { 
      id: price.id, 
      active: price.active, 
      currency: price.currency,
      unitAmount: price.unit_amount,
      recurring: price.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : 'one-time'
    });
    return true;
  } catch (err: any) {
    console.log('❌ Stripe price validation failed:', err.message);
    return false;
  }
}
