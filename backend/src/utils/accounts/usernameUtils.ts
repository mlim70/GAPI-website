// backend/src/utils/usernameUtils.ts
import matches from 'validator/lib/matches.js';

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
 * Validates if a username is in a valid format
 * @param username - The username to validate
 * @returns True if the username format is valid
 */
export function isValidUsernameFormat(username: string): boolean {
  if (!username) return false;
  
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return false;
  }
  
  // Check format: alphanumeric, hyphens, underscores, must start with letter or number
  return matches(trimmed, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
}

/**
 * Checks if two usernames are equivalent after normalization
 * @param username1 - First username
 * @param username2 - Second username
 * @returns True if the usernames are equivalent
 */
export function areUsernamesEquivalent(username1: string, username2: string): boolean {
  return normalizeUsername(username1) === normalizeUsername(username2);
}

/**
 * Gets the display version of a username (original format) but with whitespace trimmed
 * @param username - The username
 * @returns The display version of the username
 */
export function getDisplayUsername(username: string): string {
  return username.trim();
} 