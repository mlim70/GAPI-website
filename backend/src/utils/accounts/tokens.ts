import crypto from 'crypto';

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
  const expectedHash = createTokenHash(token);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
} 