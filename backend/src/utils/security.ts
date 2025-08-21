import crypto from 'crypto';

/**
 * Generate a secure, short-lived nonce for checkout session verification
 * @returns A cryptographically secure random string
 */
export function generateVerifyNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
