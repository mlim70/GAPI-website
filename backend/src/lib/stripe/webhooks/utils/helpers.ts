// backend/src/lib/stripe/webhooks/utils/helpers.ts
import User from '../../../../models/user.model';
import Stripe from 'stripe';

/**
 * Helper function to infer email from user by userId
 * Ensures non-empty email values for Order creation
 */
export async function inferEmailFromUser(subscription: { userId: string }): Promise<string> {
  try {
    const user = await User.findById(subscription.userId).select('email');
    return user?.email || 'unknown@example.com';
  } catch {
    return 'unknown@example.com';
  }
}

/**
 * Resolve the purchasing User from a Checkout Session.
 * All sessions must now have metadata.userId set.
 */
export async function resolveUserFromSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) throw new Error('Missing metadata.userId on session');
  const user = await User.findById(userId);
  if (!user) throw new Error(`userId not found: ${userId}`);
  return user;
}
