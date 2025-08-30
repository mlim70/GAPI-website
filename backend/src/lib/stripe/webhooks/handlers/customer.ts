// backend/src/lib/stripe/webhooks/handlers/customer.ts
import { stripe } from '../../client';
import User from '../../../../models/user.model';
import { logger } from '../../../../utils/general/logger';
import { StripeCustomerEvent } from '../types';

/**
 * Handle customer.created event
 */
export async function handleCustomerCreated(event: StripeCustomerEvent) {
  const customer = event.data.object;
  logger.info('👤 customer.created', { 
    id: customer.id, 
    email: customer.email 
  });

  // Handle customer creation logic here
  // This could include:
  // - Logging new customer creation
  // - Initial setup operations
  
  logger.info('✅ customer.created processed successfully:', { customerId: customer.id });
}

/**
 * Handle customer.updated event
 */
export async function handleCustomerUpdated(event: StripeCustomerEvent) {
  const customer = event.data.object;
  logger.info('👤 customer.updated', { 
    id: customer.id, 
    email: customer.email,
    name: customer.name
  });

  // Handle customer update logic here
  // This could include:
  // - Syncing customer data changes
  // - Updating local records
  
  logger.info('✅ customer.updated processed successfully:', { customerId: customer.id });
}

/**
 * Handle customer.deleted event
 */
export async function handleCustomerDeleted(event: StripeCustomerEvent) {
  const customer = event.data.object;
  logger.info('👤 customer.deleted', { 
    id: customer.id, 
    email: customer.email
  });

  // Handle customer deletion logic here
  // This could include:
  // - Cleanup operations
  // - Data archival
  
  logger.info('✅ customer.deleted processed successfully:', { customerId: customer.id });
}
