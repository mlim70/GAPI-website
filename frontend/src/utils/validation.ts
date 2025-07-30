// frontend/src/utils/validation.ts
import { isValidEmailFormat } from './emailUtils.js';

/**
 * Validates a username according to the application's rules
 * @param username - The username to validate
 * @returns An object with isValid boolean and error message if invalid
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username) {
    return { isValid: false, error: 'Username is required' };
  }
  
  const cleanUsername = username.trim();
  
  if (cleanUsername.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }
  
  if (cleanUsername.length > 30) {
    return { isValid: false, error: 'Username cannot exceed 30 characters' };
  }
  
  // Check format: alphanumeric, hyphens, underscores, must start with letter or number
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(cleanUsername)) {
    return { 
      isValid: false, 
      error: 'Username can only contain letters, numbers, hyphens, and underscores, and must start with a letter or number' 
    };
  }
  
  return { isValid: true };
}

/**
 * Normalizes a username by trimming whitespace and converting to lowercase
 * @param username - The username to normalize
 * @returns The normalized username
 */
export function normalizeUsername(username: string): string {
  if (!username) return '';
  return username.trim().toLowerCase();
}

/**
 * Validates an email address
 * @param email - The email to validate
 * @returns An object with isValid boolean and error message if invalid
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!isValidEmailFormat(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
}

/**
 * Validates a password
 * @param password - The password to validate
 * @returns An object with isValid boolean and error message if invalid
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }
  
  return { isValid: true };
}

/**
 * Validates that two passwords match
 * @param password - The password
 * @param confirmPassword - The password confirmation
 * @returns An object with isValid boolean and error message if invalid
 */
export function validatePasswordMatch(password: string, confirmPassword: string): { isValid: boolean; error?: string } {
  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' };
  }
  
  return { isValid: true };
} 