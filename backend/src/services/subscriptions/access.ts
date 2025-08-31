// backend/src/services/subscriptions/access.ts
import User, { IUser } from '../../models/user.model';
import Subscription from '../../models/subscription.model';
import { logger } from '../../utils/general/logger';
import { Types } from 'mongoose';

/**
 * Helper function to recompute user's membership level based on remaining active subscriptions
 * This ensures users don't lose access when they have multiple active subscriptions
 * 
 * Selection logic:
 * - Ignores CANCELLED, EXPIRED, SUPERSEDED subscriptions (only matches status: 'ACTIVE')
 * - Prefers ONE_TIME ACTIVE (Lifetime) over any RECURRING ACTIVE
 * - Falls back to best remaining ACTIVE subscription
 */
export async function recomputeUserMembershipLevel(userId: any) {
  try {
    const u = await User.findById(userId).select('status').lean();
    if (!u) return null;
    
    // locked states you already have
    const locked: Array<IUser['status']> = ['DELETED', 'REFUNDED'];
    if (locked.includes(u.status)) return null; // don't change it

    // Cast userId to ObjectId for aggregation - Mongoose doesn't auto-cast in $match
    const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    // Use aggregation to properly sort by subscription kind priority
    // Priority: ONE_TIME (Lifetime) > RECURRING > FREE, then by creation date (newest first)
    const activeSubscriptions = await Subscription.aggregate([
      { $match: { userId: uid, status: 'ACTIVE' } },
      { $addFields: {
          kindPriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$kind', 'ONE_TIME'] }, then: 3 },
                { case: { $eq: ['$kind', 'RECURRING'] }, then: 2 },
              ],
              default: 0
            }
          }
        }
      },
      { $sort: { kindPriority: -1, createdAt: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'membershiplevels', localField: 'levelId', foreignField: '_id', as: 'levelId' } },
      { $unwind: '$levelId' }
    ]);

    const activeSubscription = activeSubscriptions[0];

    if (activeSubscription?.levelId) {
      // User has another active subscription, set membership level accordingly
      const membershipLevel = activeSubscription.levelId as any;
      // Only update if the membership level has actually changed
      const updateResult = await User.updateOne(
        { _id: userId, membershipLevel: { $ne: membershipLevel.key } }, 
        { $set: { membershipLevel: membershipLevel.key } },
        { runValidators: true }
      );
      
      if (updateResult.modifiedCount > 0) {
        logger.info('Updated user membership level from remaining active subscription:', {
          userId,
          membershipLevel: membershipLevel.key,
          subscriptionId: activeSubscription._id
        });
      } else {
        logger.info('User membership level unchanged:', {
          userId,
          membershipLevel: membershipLevel.key
        });
      }
      return membershipLevel.key;
    } else {
      // No active subscriptions remain, clear membership level
      // Only update if it's currently set
      const updateResult = await User.updateOne(
        { _id: userId, membershipLevel: { $exists: true } }, 
        { $unset: { membershipLevel: 1 } },
        { runValidators: true }
      );
      
      if (updateResult.modifiedCount > 0) {
        logger.info('Cleared membership level - no active subscriptions remain:', userId);
      } else {
        logger.info('User membership level already cleared:', userId);
      }
      return null;
    }
  } catch (error) {
    logger.error('Failed to recompute user membership level:', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
