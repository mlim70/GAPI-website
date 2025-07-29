// backend/src/models/subscription.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  levelId: Types.ObjectId;
  gateway: 'stripe' | 'paypal';
  gatewaySubId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  nextBillDate?: Date;
  cancelDate?: Date;
}

const subscriptionSchema: Schema<ISubscription> = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  levelId:        { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipLevel', required: true, index: true },
  gateway:        { type: String, enum: ['stripe', 'paypal'], required: true },
  gatewaySubId:   { type: String, required: true, unique: true, index: true },
  status:         { type: String, enum: ['ACTIVE', 'CANCELLED', 'EXPIRED'], required: true },
  startDate:      { type: Date, required: true },
  nextBillDate:   { type: Date },
  cancelDate:     { type: Date },
}, {
  timestamps: true,
  autoIndex: process.env.NODE_ENV !== 'test' // Disable autoIndex in test mode to avoid DB-drop races
});

subscriptionSchema.index({ status: 1, nextBillDate: 1 });

const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription; 