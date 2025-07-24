import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
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

export default mongoose.model('Subscription', subscriptionSchema); 