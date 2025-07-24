import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  subscriptionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  gatewayPaymentId: { type: String, required: true, unique: true, index: true },
  amount:           { type: Number, required: true },
  currency:         { type: String, required: true },
  status:           { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], required: true },
  paidAt:           { type: Date, required: true },
  createdAt:        { type: Date, default: Date.now }
});

paymentSchema.index({ subscriptionId: 1, paidAt: -1 });

export default mongoose.model('Payment', paymentSchema); 