// backend/src/utils/billingUtils.ts

/**
 * Checks if on-behalf purchases are allowed via environment variable
 */
export function envAllowOnBehalf(): boolean {
  return String(process.env.ALLOW_ON_BEHALF || '').toLowerCase() === 'true';
}

/**
 * Checks if a billing profile is owned by a specific user
 */
export function isOwnedBy(bp: any, userId: string): boolean {
  return bp.ownerUserId?.toString() === userId;
}
