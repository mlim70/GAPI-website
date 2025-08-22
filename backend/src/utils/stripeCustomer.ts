import { stripe } from '../lib/stripe';

/**
 * Ensures a Stripe customer exists for the given user.
 * Creates a new customer if one doesn't exist, otherwise returns the existing customer ID.
 * 
 * @param user - User object with email, name, and optional stripeCustomerId
 * @returns Promise<string> - The Stripe customer ID
 */
export async function ensureStripeCustomer(user: any): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  
  // Generate idempotency key to prevent duplicate customer creation on retries
  const idemKey = `customer:create:${user._id}:${Date.now()>>12}`;
  
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user._id.toString() },
    name: user.name?.first ? `${user.name.first} ${user.name.last ?? ''}`.trim() : user.username
  }, { idempotencyKey: idemKey });
  
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}
