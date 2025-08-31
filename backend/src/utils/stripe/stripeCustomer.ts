// backend/src/utils/stripe/stripeCustomer.ts
import { stripe } from '../../lib/stripe/client';
import { normalizeEmail } from '../email/emailUtils';

/**
 * Ensures a Stripe customer exists for the given user.
 * Creates a new customer if one doesn't exist, otherwise returns the existing customer ID.
 * 
 * @param user - User object with email, name, and optional stripeCustomerId
 * @returns Promise<string> - The Stripe customer ID
 */
export async function ensureStripeCustomer(user: any): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  
  // Normalize email to avoid edge-cases with email canonicalization
  const email = normalizeEmail(user.email);
  const emailHash = Buffer.from(email).toString('base64').slice(0, 8);
  const idemKey = `customer:create:${user._id}:${emailHash}`;
  
  const customer = await stripe.customers.create({
    email,
    metadata: { userId: user._id.toString() },
    name: user.name?.first ? `${user.name.first} ${user.name.last ?? ''}`.trim() : user.username
  }, { idempotencyKey: idemKey });
  
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}
