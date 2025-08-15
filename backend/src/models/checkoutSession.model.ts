import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingUser', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // IMPORTANT: no default:null — just omit until you have a real cs_...
  stripeSessionId: { type: String },
  status: { type: String, enum: ['CREATED', 'COMPLETED', 'EXPIRED'], default: 'CREATED' },
  ready: { type: Boolean, default: false },
  readyAt: Date,
  finalizing: { type: Boolean, default: false },
  finalizingAt: Date,
  completedAt: Date,
  stripeSessionStatus: String,
  stripePaymentStatus: String,
  pendingUserEmail: String,
  levelKey: String,
  expiresAt: { type: Date, index: true }, // TTL via initIndexes
}, { 
  timestamps: true,
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 