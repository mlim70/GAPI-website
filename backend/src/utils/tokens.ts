import crypto from 'crypto';

/**
 * Generates a verification token and its hash for secure storage
 * @returns { token: string, hash: string } - The token to send to user and hash to store in DB
 */
export function generateVerificationToken(): { token: string; hash: string } {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Create a hash of the token
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, hash };
}

/**
 * Verifies a token against its stored hash
 * @param token - The token provided by the user
 * @param hash - The hash stored in the database
 * @returns boolean - True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
} 