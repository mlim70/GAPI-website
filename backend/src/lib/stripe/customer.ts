// backend/src/lib/stripe/customer.ts
import { stripe } from './client';
import { logger } from '../../utils/general/logger';

interface UserWithStripe {
  _id: string;
  email: string;
  name: { first: string; last: string };
  stripeCustomerId?: string;
}

/**
 * Ensures a Stripe customer exists for the given user.
 * Creates one if it doesn't exist, otherwise returns the existing ID.
 * @param user - User object with email, name, and optional stripeCustomerId
 * @returns Promise<string> - The Stripe customer ID
 */
export async function ensureStripeCustomer(user: UserWithStripe): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  logger.info(`Creating new Stripe customer for user: ${user.email}`);
  
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.name.first} ${user.name.last}`,
      metadata: { userId: user._id.toString() }
    });

    user.stripeCustomerId = customer.id;
    return customer.id;
  } catch (error) {
    logger.error('Failed to create Stripe customer:', error);
    throw new Error('Failed to create Stripe customer');
  }
}
