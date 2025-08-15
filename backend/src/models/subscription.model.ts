// backend/src/models/subscription.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  levelId: Types.ObjectId;
  kind: 'ONE_TIME' | 'RECURRING' | 'FREE';
  autoRenews: boolean;
  gateway: 'stripe' | 'internal'; // 'internal' for FREE subscriptions
  gatewaySubId?: string | null; // optional (RECURRING only)
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  endDate?: Date | null;
  nextBillDate?: Date | null;
  cancelDate?: Date | null;
}

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  levelId: { type: Schema.Types.ObjectId, ref: 'MembershipLevel', required: true },
  kind: { type: String, enum: ['ONE_TIME', 'RECURRING', 'FREE'], required: true },
  autoRenews: { type: Boolean, required: true },
  gateway: { type: String, enum: ['stripe', 'internal'], required: true },
  gatewaySubId: { type: String, required: false },
  status: { type: String, enum: ['ACTIVE', 'CANCELLED', 'EXPIRED'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  nextBillDate: { type: Date, default: null },
  cancelDate: { type: Date, default: null },
}, {
  timestamps: true,
  autoIndex: false
});

const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription; 