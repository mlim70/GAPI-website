import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stripeSessionId: { type: String, required: true, index: true },
  levelKey: { type: String, required: true },
  status: { type: String, default: 'CREATED' },
  expiresAt: { type: Date, index: true }, // TTL via initIndexes
}, { 
  timestamps: true,
  strict: true,
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 