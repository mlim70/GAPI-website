import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingUser' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  stripeSessionId: { type: String },
  status: { type: String, enum: ['CREATED', 'COMPLETED', 'EXPIRED'], default: 'CREATED' },
  levelKey: String,
  expiresAt: { type: Date }, // TTL via initIndexes
}, { 
  timestamps: true,
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 