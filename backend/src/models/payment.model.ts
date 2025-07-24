// backend/src/models/payment.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
  subscriptionId: Types.ObjectId;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt: Date;
  createdAt: Date;
}

const paymentSchema: Schema<IPayment> = new mongoose.Schema({
  subscriptionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  gatewayPaymentId: { type: String, required: true, unique: true, index: true },
  amount:           { type: Number, required: true },
  currency:         { type: String, required: true },
  status:           { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], required: true },
  paidAt:           { type: Date, required: true },
  createdAt:        { type: Date, default: Date.now }
});

paymentSchema.index({ subscriptionId: 1, paidAt: -1 });

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment; 