import { Types } from 'mongoose';
import Subscription from '../../models/subscription.model';

export async function getUserCurrentSubscription(userId: string | Types.ObjectId) {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  // Get the most recent subscription (regardless of status)
  const sub = await Subscription.findOne({ userId: uid })
    .sort({ startDate: -1, createdAt: -1 })
    .populate('levelId');

  if (!sub) return { sub: null, displayStatus: null };

  // If we already consider it ACTIVE, just surface it
  if (sub.status === 'ACTIVE') return { sub, displayStatus: 'ACTIVE' as const };

  // Otherwise, treat as "pending" if very fresh
  const freshMs = Date.now() - new Date(sub.createdAt).getTime();
  const isVeryRecent = freshMs < 10 * 60 * 1000; // 10 minutes
  return { sub, displayStatus: isVeryRecent ? 'PENDING_ACTIVATION' as const : sub.status };
}
