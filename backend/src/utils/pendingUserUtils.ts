// backend/src/utils/pendingUserUtils.ts
import PendingUser from '../models/pendingUser.model';
import CheckoutSession from '../models/checkoutSession.model';

/**
 * Checks if a PendingUser has expired and cleans up if necessary
 * @param pendingUser - The PendingUser to check
 * @returns Object with isExpired boolean and cleanup info
 */
export async function checkPendingUserExpiration(pendingUser: any) {
  const now = new Date();
  const isExpired = pendingUser.expiresAt < now;
  
  const result = {
    isExpired,
    now,
    expiresAt: pendingUser.expiresAt,
    timeUntilExpiry: pendingUser.expiresAt.getTime() - now.getTime(),
    cleanupPerformed: false,
    deletedCheckoutSessions: 0
  };
  
  if (isExpired) {
    console.log(`🗑️ PendingUser has expired, performing cleanup`);
    
    // Cascade cleanup: Delete related CheckoutSession records first
    const deletedCheckoutSessions = await CheckoutSession.deleteMany({ 
      pendingUserId: pendingUser._id 
    });
    
    // Delete the expired pending user
    await PendingUser.findByIdAndDelete(pendingUser._id);
    
    result.cleanupPerformed = true;
    result.deletedCheckoutSessions = deletedCheckoutSessions.deletedCount;
    
    console.log(`🗑️ Cleaned up ${deletedCheckoutSessions.deletedCount} related CheckoutSession records`);
  }
  
  return result;
}

/**
 * Finds and handles expired PendingUser records
 * @param email - Email to search for
 * @param username - Username to search for
 * @returns Object with found PendingUser and expiration status
 */
export async function findAndHandleExpiredPendingUser(email: string, username: string) {
  const existingPendingUser = await PendingUser.findOne({ 
    $or: [{ email }, { username }] 
  });
  
  if (!existingPendingUser) {
    return { found: false, pendingUser: null, expirationInfo: null };
  }
  
  const expirationInfo = await checkPendingUserExpiration(existingPendingUser);
  
  return {
    found: true,
    pendingUser: existingPendingUser,
    expirationInfo
  };
}

/**
 * Validates if a PendingUser is still valid (not expired)
 * @param pendingUser - The PendingUser to validate
 * @returns True if the PendingUser is still valid
 */
export function isPendingUserValid(pendingUser: any): boolean {
  if (!pendingUser || !pendingUser.expiresAt) {
    return false;
  }
  
  return pendingUser.expiresAt > new Date();
} 