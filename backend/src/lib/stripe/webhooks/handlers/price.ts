// backend/src/lib/stripe/webhooks/handlers/price.ts
import { logger } from '../../../../utils/general/logger';
import { invalidatePrice } from '../../../../utils/stripe/cache';
import { StripePriceEvent } from '../types';

/**
 * Handle price.updated event
 * Invalidates the price cache to ensure fresh data on next checkout
 */
export async function handlePriceUpdated(event: StripePriceEvent) {
  const price = event.data.object;
  logger.info('📅 price.updated', { 
    id: price.id, 
    active: price.active,
    currency: price.currency
  });

  // Invalidate the price cache to ensure fresh data
  invalidatePrice(price.id);
  
  logger.info('✅ price.updated processed successfully:', { priceId: price.id });
}

/**
 * Handle price.deleted event
 * Invalidates the price cache and removes from database
 */
export async function handlePriceDeleted(event: StripePriceEvent) {
  const price = event.data.object;
  logger.info('📅 price.deleted', { 
    id: price.id 
  });

  // Invalidate the price cache
  invalidatePrice(price.id);
  
  // Note: Database cleanup is handled in syncStripeMemberships.ts
  // This handler focuses on cache invalidation
  
  logger.info('✅ price.deleted processed successfully:', { priceId: price.id });
}
