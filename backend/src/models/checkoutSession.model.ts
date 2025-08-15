import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingUser' },
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
  priceId: String,
  expiresAt: { type: Date }, // TTL via initIndexes
  
  // Billing profile relationships
  billingProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingProfile' },
  beneficiaryUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { 
  timestamps: true,
  autoIndex: false 
});

export default mongoose.models.CheckoutSession ||
  mongoose.model('CheckoutSession', checkoutSessionSchema); 