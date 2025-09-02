import crypto from 'crypto';
import User from '../../models/user.model';
import { createUTCDate } from '../general/dateUtils';
import { logger } from '../general/logger';

/**
 * Creates a SHA-256 hash of a token
 * @param token - The token to hash
 * @returns string - The hash of the token
 */
function createTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a verification token and its hash for secure storage
 * @returns { token: string, hash: string } - The token to send to user and hash to store in DB
 */
export function generateVerificationToken(): { token: string; hash: string } {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Create a hash of the token
  const hash = createTokenHash(token);
  
  return { token, hash };
}

/**
 * Hashes a verification token for verification purposes
 * @param token - The token to hash
 * @returns string - The hash of the token
 */
export function hashVerificationToken(token: string): string {
  return createTokenHash(token);
}

/**
 * Verifies a token against its stored hash using timing-safe comparison
 * @param token - The token provided by the user
 * @param hash - The hash stored in the database
 * @returns boolean - True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const expected = createTokenHash(token);
  if (expected.length !== hash?.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
} 

/**
 * Overwrite any prior reset token and set a new one with custom TTL (hours)
 * Returns the raw token and absolute expiry.
 */
export async function issueResetTokenForUser(userId: string, hoursValid: number) {
  // Invalidate any existing token
  await User.findByIdAndUpdate(userId, {
    $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = createUTCDate(hoursValid); // createUTCDate accepts hours; 144h = 6 days

  // Store new token
  await User.findByIdAndUpdate(userId, {
    $set: { resetTokenHash: hash, resetTokenExpires: expires }
  });

  logger.debug('Issued reset token', {
    userId,
    hoursValid,
    expiresAt: expires.toISOString(),
  });

  return { rawToken, expires };
} 