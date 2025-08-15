import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingUser' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  stripeSessionId: { type: String },
  customerId: { type: String }, // Stripe customer ID
  priceId: { type: String }, // Stripe price ID
  status: { type: String, default: 'CREATED' }, // Allow any status value from webhooks
  levelKey: String,
  expiresAt: { type: Date }, // TTL via initIndexes
  ready: { type: Boolean, default: false }, // Whether the session is ready for use
  
  // Add these missing fields that are written elsewhere:
  stripeSessionStatus: { type: String },   // 'open' | 'complete' | etc
  stripePaymentStatus: { type: String },   // 'paid' | 'unpaid' | 'no_payment_required'
  completedAt: { type: Date },
  readyAt: { type: Date },
  pendingUserEmail: { type: String },   // written during upsert operations
}, { 
  timestamps: true,
  strict: true, // keep strict true; now the fields exist so updates won't be dropped
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 