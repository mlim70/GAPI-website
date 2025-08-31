// backend/src/models/subscription.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  levelId: Types.ObjectId;
  planName: string; // Name of the membership plan
  kind: 'ONE_TIME' | 'RECURRING' | 'FREE';
  autoRenews: boolean;
  gateway: 'stripe' | 'internal'; // 'internal' for FREE subscriptions
  stripeSubscriptionId?: string | null; // (RECURRING only) - Stripe subscription ID
  stripeStatus?: string; // 'trialing' | 'active' | 'past_due' | ...
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUPERSEDED';
  startDate: Date;
  endDate?: Date | null;
  nextBillDate?: Date | null;
  cancelDate?: Date | null;
  cancelReason?: string; // Reason for cancellation
  supersededBy?: Types.ObjectId; // Reference to subscription that superseded this one
  supersededAt?: Date; // When this subscription was superseded
  createdAt: Date;
  updatedAt: Date;
  
  // Note: Users can have multiple ACTIVE subscriptions of different kinds
  // (e.g., ACTIVE RECURRING + ACTIVE ONE_TIME during lifetime upgrade)
  // Database constraint: unique on { userId: 1, status: 1, kind: 1 } for ACTIVE status
  // Business logic priority: RECURRING > ONE_TIME > FREE (see recomputeUserMembershipLevel)
}

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  levelId: { type: Schema.Types.ObjectId, ref: 'MembershipLevel', required: true },
  planName: { type: String, required: true }, // Name of the membership plan
  kind: { type: String, enum: ['ONE_TIME', 'RECURRING', 'FREE'], required: true },
  autoRenews: { type: Boolean, required: true },
  gateway: { type: String, enum: ['stripe', 'internal'], required: true },
  stripeSubscriptionId: { type: String, required: false },
  stripeStatus: { type: String }, // raw status from Stripe, for UI
  status: { type: String, enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  nextBillDate: { type: Date, default: null },
  cancelDate: { type: Date, default: null },
  cancelReason: { type: String }, // Reason for cancellation (e.g., 'account_deleted', 'user_requested', 'payment_failed')
  supersededBy: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  supersededAt: { type: Date },
}, {
  timestamps: true,
  autoIndex: false
});

const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription; 