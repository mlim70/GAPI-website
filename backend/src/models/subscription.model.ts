// backend/src/models/subscription.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  levelId: Types.ObjectId;
  planName: string; // Name of the membership plan
  kind: 'ONE_TIME' | 'RECURRING' | 'FREE';
  autoRenews: boolean;
  gateway: 'stripe' | 'internal'; // 'internal' for FREE subscriptions
  stripeSubscriptionId?: string | null; // optional (RECURRING only) - Stripe subscription ID
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  endDate?: Date | null;
  nextBillDate?: Date | null;
  cancelDate?: Date | null;
  cancelReason?: string; // Reason for cancellation
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  levelId: { type: Schema.Types.ObjectId, ref: 'MembershipLevel', required: true },
  planName: { type: String, required: true }, // Name of the membership plan
  kind: { type: String, enum: ['ONE_TIME', 'RECURRING', 'FREE'], required: true },
  autoRenews: { type: Boolean, required: true },
  gateway: { type: String, enum: ['stripe', 'internal'], required: true },
  stripeSubscriptionId: { type: String, required: false },
  status: { type: String, enum: ['ACTIVE', 'CANCELLED', 'EXPIRED'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  nextBillDate: { type: Date, default: null },
  cancelDate: { type: Date, default: null },
  cancelReason: { type: String }, // Reason for cancellation
}, {
  timestamps: true,
  autoIndex: false
});



// ---- Indexes ----
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ userId: 1, status: 1 });

const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription; 