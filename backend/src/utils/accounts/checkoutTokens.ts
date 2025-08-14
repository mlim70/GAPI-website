import jwt from 'jsonwebtoken';

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

export interface CheckoutTokenPayload {
  sub: string; // pendingUserId
  email: string;
  levelKey: string;
  purpose: 'checkout';
  iat?: number;
  exp?: number;
}

/**
 * Generate a checkout token for a verified pending user
 * @param pendingUserId - The pending user's ID
 * @param email - The user's email
 * @param levelKey - The membership level key
 * @returns JWT token valid for 15 minutes
 */
export function generateCheckoutToken(
  pendingUserId: string,
  email: string,
  levelKey: string
): string {
  const payload: CheckoutTokenPayload = {
    sub: pendingUserId,
    email: email.toLowerCase().trim(),
    levelKey,
    purpose: 'checkout'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Verify a checkout token
 * @param token - The JWT token to verify
 * @returns Decoded payload if valid
 * @throws JWT verification errors if invalid
 */
export function verifyCheckoutToken(token: string): CheckoutTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as CheckoutTokenPayload;
  
  // Additional validation
  if (payload.purpose !== 'checkout') {
    throw new Error('Invalid token purpose');
  }
  
  if (!payload.sub || !payload.email || !payload.levelKey) {
    throw new Error('Invalid token payload');
  }
  
  return payload;
}

/**
 * Generate an idempotency key for Stripe checkout sessions
 * @param pendingUserId - The pending user's ID
 * @param levelKey - The membership level key
 * @param nonce - Optional nonce for additional uniqueness
 * @returns Unique idempotency key
 */
export function generateIdempotencyKey(
  pendingUserId: string,
  levelKey: string,
  nonce?: string
): string {
  const base = `${pendingUserId}-${levelKey}`;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  
  if (nonce) {
    return `${base}-${timestamp}-${random}-${nonce}`;
  }
  
  return `${base}-${timestamp}-${random}`;
}
