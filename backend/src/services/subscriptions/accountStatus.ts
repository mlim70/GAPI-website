// backend/src/services/subscriptions/accountStatus.ts
import User, { IUser } from '../../models/user.model';
import Subscription from '../../models/subscription.model';
import { logger } from '../../utils/general/logger';

/**
 * Recompute user's account status based on active subscriptions
 * This is the authoritative function for determining user access
 * 
 * Rules:
 * - ACTIVE entitlements = ONE_TIME(Lifetime) ACTIVE OR any RECURRING ACTIVE
 * - Only ACTIVE grants access
 * - No active subscriptions = CANCELLED status
 */
export async function recomputeUserAccountStatus(userId: any) {
  try {
    const u = await User.findById(userId).select('status').lean();
    if (!u) return;

    // locked states you already have
    const locked: Array<IUser['status']> = ['DELETED', 'REFUNDED'];
    if (locked.includes(u.status)) return u.status; // don't change it

    const hasActive = await Subscription.exists({ userId, status: 'ACTIVE' });

    if (hasActive) {
      await User.updateOne(
        { _id: userId, status: { $ne: 'ACTIVE' } },
        { $set: { status: 'ACTIVE', statusChangedAt: new Date(), statusReason: 'has_active_subscription' } },
        { runValidators: true }
      );
      return 'ACTIVE';
    } else {
      await User.updateOne(
        { _id: userId, status: { $ne: 'CANCELLED' } },
        { $set: { status: 'CANCELLED', statusChangedAt: new Date(), statusReason: 'no_active_subscription' }, $unset: { membershipLevel: 1 } },
        { runValidators: true }
      );
      return 'CANCELLED';
    }
  } catch (e) {
    logger.error('Failed to recompute user account status:', { userId, error: String(e) });
    throw e;
  }
}
