import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stripeSessionId: { type: String, required: true },
  mode: { type: String, enum: ['payment', 'subscription'], required: true },
  levelKey: { type: String },
  levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipLevel' },
  priceId: { type: String },
  stripeCustomerId: { type: String },
  paymentIntentId: { type: String },   // critical for one-time mapping
  subscriptionId: { type: String },    // stripe sub id (for mode=sub)
  status: { 
    type: String, 
    enum: ['CREATED', 'EXPIRED', 'COMPLETED', 'CANCELLED'], 
    default: 'CREATED' 
  },
  ready: { type: Boolean, default: false, index: true },
  readyAt: { type: Date },
  
  expiresAt: { type: Date },           // TTL via initIndexes
  verifyNonce: { type: String, required: true }, // Security nonce for session verification
}, { 
  timestamps: true,
  strict: true,
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 