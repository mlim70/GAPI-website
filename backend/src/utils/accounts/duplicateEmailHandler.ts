// backend/src/utils/accounts/duplicateEmailHandler.ts
import User from '../../models/user.model';
import { logger } from '../general/logger';

/**
 * Handles duplicate email constraint violations during user activation
 * 
 * Strategy (First Come, First Serve):
 * 1. Activate the user being activated (first come, first serve)
 * 2. Delete all other non-active users with the same email
 * 
 * @param userId - The ID of the user being activated
 * @returns The ID of the user to use (same as input)
 */
export async function handleDuplicateEmailActivation(userId: string): Promise<string> {
  logger.warn('⚠️ Duplicate email detected during activation, attempting cleanup:', { userId });
  
  // Find the user we're trying to activate
  const activatingUser = await User.findById(userId);
  if (!activatingUser) {
    throw new Error('Activating user not found during duplicate email cleanup');
  }
  
  // Find all users with the same email
  const duplicateUsers = await User.find({ 
    email: activatingUser.email 
  });
  
  if (duplicateUsers.length <= 1) {
    throw new Error('Unexpected: No duplicates found despite constraint violation');
  }
  
  // Strategy: First come, first serve - activate the requesting user, delete other non-active users
  const otherNonActiveUsers = duplicateUsers.filter(u => 
    u._id.toString() !== userId && u.status !== 'ACTIVE'
  );
  
  if (otherNonActiveUsers.length > 0) {
    logger.info('🔄 First come, first serve: activating requesting user, deleting other non-active users:', {
      activatingUserId: userId,
      deleteUserIds: otherNonActiveUsers.map(u => u._id)
    });
    
    // Delete all other non-active users with the same email
    await User.deleteMany({ 
      _id: { $in: otherNonActiveUsers.map(u => u._id) }
    });
    
    logger.info('✅ Other non-active users deleted, activation can proceed');
  }
  
  // Return the original userId since we're activating the requesting user
  return userId;
}

/**
 * Wrapper function to safely activate a user with duplicate email handling
 * 
 * @param userId - The ID of the user to activate
 * @returns Object with modifiedCount and the userId to use going forward (same as input)
 */
export async function safeActivateUser(userId: string): Promise<{ modifiedCount: number; userId: string }> {
  try {
    // Guard: Never resurrect deleted/refunded users
    const lockedStatuses = ['DELETED', 'REFUNDED'] as const;
    const u = await User.findById(userId).select('status email').lean();
    if (!u) {
      throw new Error('User not found during activation');
    }
    
    if (lockedStatuses.includes(u.status as any)) {
      // Never change status for locked accounts
      logger.debug('User activation skipped - account is locked:', { userId, status: u.status });
      return { modifiedCount: 0, userId };
    }

    // ALWAYS check for and clean up duplicate users, even if user is already ACTIVE
    logger.debug('Checking for duplicate users before activation:', { userId, email: u.email });
    const duplicateUsers = await User.find({ 
      email: u.email,
      _id: { $ne: userId },
      status: { $ne: 'ACTIVE' }
    });

    if (duplicateUsers.length > 0) {
      logger.info('🔄 Found duplicate non-ACTIVE users during activation, cleaning up:', {
        activatingUserId: userId,
        duplicateCount: duplicateUsers.length,
        duplicateUserIds: duplicateUsers.map(user => user._id)
      });

      // Delete all other non-ACTIVE users with the same email
      await User.deleteMany({ 
        _id: { $in: duplicateUsers.map(user => user._id) }
      });

      logger.info('✅ Duplicate non-ACTIVE users cleaned up before activation');
    }

    // Now proceed with activation (only if not already ACTIVE)
    if (u.status === 'ACTIVE') {
      logger.debug('User already ACTIVE, cleanup completed but no activation needed:', { userId });
      return { modifiedCount: 0, userId };
    }

    const result = await User.updateOne(
      { _id: userId, status: { $ne: 'ACTIVE' } },
      { 
        $set: { status: 'ACTIVE' },
        $unset: { signupIntent: 1 }
      },
      { runValidators: true }
    );
    
    return { modifiedCount: result.modifiedCount, userId };
  } catch (activationError: any) {
    // Handle duplicate email constraint violation (fallback)
    if (activationError.code === 11000 && activationError.keyPattern?.email) {
      await handleDuplicateEmailActivation(userId);
      
      // After cleanup, retry the activation (should succeed now)
      const result = await User.updateOne(
        { _id: userId, status: { $ne: 'ACTIVE' } },
        { 
          $set: { status: 'ACTIVE' },
          $unset: { signupIntent: 1 }
        },
        { runValidators: true }
      );
      
      return { modifiedCount: result.modifiedCount, userId };
    } else {
      // Re-throw if it's not a duplicate email error
      throw activationError;
    }
  }
}
