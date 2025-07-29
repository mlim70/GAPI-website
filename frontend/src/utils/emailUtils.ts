// frontend/src/utils/emailUtils.ts

/**
 * Known email providers that support dot and plus addressing
 */
const KNOWN_PROVIDERS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'protonmail.com',
  'pm.me'
];

/**
 * Normalizes an email address by:
 * 1. Trimming whitespace
 * 2. Converting to lowercase
 * 3. Removing dots and plus tags for known providers
 * @param email - The email address to normalize
 * @returns The normalized email address
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  
  // Trim whitespace and convert to lowercase
  let normalized = email.trim().toLowerCase();
  
  // Extract domain
  const atIndex = normalized.indexOf('@');
  if (atIndex === -1) return normalized; // Invalid email, return as-is
  
  const localPart = normalized.substring(0, atIndex);
  const domain = normalized.substring(atIndex + 1);
  
  // Check if it's a known provider that supports dot/plus addressing
  if (KNOWN_PROVIDERS.includes(domain)) {
    // Remove dots from local part
    let cleanLocalPart = localPart.replace(/\./g, '');
    
    // Remove plus tag (everything after + but before @)
    const plusIndex = cleanLocalPart.indexOf('+');
    if (plusIndex !== -1) {
      cleanLocalPart = cleanLocalPart.substring(0, plusIndex);
    }
    
    return `${cleanLocalPart}@${domain}`;
  }
  
  return normalized;
}

/**
 * Checks if two email addresses are equivalent after normalization
 * @param email1 - First email address
 * @param email2 - Second email address
 * @returns True if the emails are equivalent
 */
export function areEmailsEquivalent(email1: string, email2: string): boolean {
  return normalizeEmail(email1) === normalizeEmail(email2);
}

/**
 * Gets the display version of an email (original format) but with whitespace trimmed
 * @param email - The email address
 * @returns The display version of the email
 */
export function getDisplayEmail(email: string): string {
  return email.trim();
}

/**
 * Validates if an email address is in a valid format
 * @param email - The email address to validate
 * @returns True if the email format is valid
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email) return false;
  
  const trimmed = email.trim();
  if (!trimmed) return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Shows a warning message for users about email aliasing
 * @param email - The email address
 * @returns Warning message if applicable, null otherwise
 */
export function getEmailAliasWarning(email: string): string | null {
  if (!email) return null;
  
  const normalized = normalizeEmail(email);
  const display = getDisplayEmail(email);
  
  // If the normalized version is different from the display version,
  // it means there are dots or plus tags that will be ignored
  if (normalized !== display.toLowerCase()) {
    return `Note: This email will be treated as ${normalized} (dots and plus tags are ignored for this provider).`;
  }
  
  return null;
} 