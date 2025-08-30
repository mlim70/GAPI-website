// backend/src/lib/stripe/webhooks/handlers/product.ts
import { logger } from '../../../../utils/general/logger';
import { invalidateProduct } from '../../../../utils/stripe/cache';
import { StripeProductEvent } from '../types';

/**
 * Handle product.updated event
 * Invalidates the product cache to ensure fresh data on next checkout
 */
export async function handleProductUpdated(event: StripeProductEvent) {
  const product = event.data.object;
  logger.info('📅 product.updated', { 
    id: product.id, 
    active: product.active,
    name: product.name
  });

  // Invalidate the product cache to ensure fresh data
  invalidateProduct(product.id);
  
  logger.info('✅ product.updated processed successfully:', { productId: product.id });
}

/**
 * Handle product.deleted event
 * Invalidates the product cache
 */
export async function handleProductDeleted(event: StripeProductEvent) {
  const product = event.data.object;
  logger.info('📅 product.deleted', { 
    id: product.id 
  });

  // Invalidate the product cache
  invalidateProduct(product.id);
  
  // Note: Database cleanup is handled in syncStripeMemberships.ts
  // This handler focuses on cache invalidation
  
  logger.info('✅ product.deleted processed successfully:', { productId: product.id });
}
