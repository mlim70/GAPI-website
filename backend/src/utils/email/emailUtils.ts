// backend/src/utils/email/emailUtils.ts
import isEmail from 'validator/lib/isEmail.js';

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
  if (!email || !isEmail(email)) return '';
  
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
  
  // Use validator library for comprehensive email validation
  return isEmail(trimmed);
}

// Contact form validation interface and function
interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates contact form data including email validation
 */
export function validateContactForm(data: ContactFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate name
  if (!data.name || !data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters long';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  // Validate email
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmailFormat(data.email)) {
    errors.email = 'Please enter a valid email address';
  } else if (data.email.length > 254) {
    errors.email = 'Email address is too long';
  }

  // Validate subject
  if (!data.subject || !data.subject.trim()) {
    errors.subject = 'Subject is required';
  } else if (data.subject.trim().length < 3) {
    errors.subject = 'Subject must be at least 3 characters long';
  } else if (data.subject.trim().length > 200) {
    errors.subject = 'Subject must be less than 200 characters';
  }

  // Validate message
  if (!data.message || !data.message.trim()) {
    errors.message = 'Message is required';
  } else if (data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters long';
  } else if (data.message.trim().length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
} 