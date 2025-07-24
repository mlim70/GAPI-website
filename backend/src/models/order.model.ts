// backend/src/models/order.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IOrder extends Document {
  subscriptionId?: Types.ObjectId; // Nullable for one-time purchases
  membershipLevelId: Types.ObjectId;
  gatewayPaymentId: string;
  total: number;
  currency: string;
  billing: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      line1: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
    };
  };
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema: Schema<IOrder> = new mongoose.Schema({
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: false, index: true },
  membershipLevelId: { type: Schema.Types.ObjectId, ref: 'MembershipLevel', required: true, index: true },
  gatewayPaymentId: { type: String, required: true, unique: true, index: true },
  total: { type: Number, required: true },
  currency: { type: String, required: true },
  billing: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: {
      line1: { type: String },
      city: { type: String },
      region: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
  },
  status: { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], required: true },
  paidAt: { type: Date, required: true },
  refundedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
export default Order; 