// backend/src/utils/billingUtils.ts
/**
 * Checks if a billing profile is owned by a specific user
 */
export function isOwnedBy(bp: any, userId: string): boolean {
  return bp.ownerUserId?.toString() === userId;
}
