// backend/src/models/subscription.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  levelId: Types.ObjectId;
  gatewaySubId: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  nextBillDate?: Date;
  cancelDate?: Date;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema: Schema<ISubscription> = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  levelId:        { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipLevel', required: true, index: true },
  gatewaySubId:   { type: String, required: true, unique: true, index: true },
  status:         { type: String, enum: ['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED'], required: true },
  startDate:      { type: Date, required: true },
  nextBillDate:   { type: Date },
  cancelDate:     { type: Date },
  orderCount:     { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now }
});

subscriptionSchema.index({ status: 1, nextBillDate: 1 });

const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription; 