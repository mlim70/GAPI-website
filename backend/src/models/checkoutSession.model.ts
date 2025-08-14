import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { 
    type: mongoose.Types.ObjectId, 
    ref: 'PendingUser', 
    required: true 
  },
  pendingUserEmail: {
    type: String,
    required: true,
  },
  stripeSessionId: { 
    type: String, 
    unique: true,
    required: false 
  },
  status: { 
    type: String, 
    enum: ['CREATED', 'COMPLETED', 'EXPIRED', 'READY'], 
    default: 'CREATED' 
  },
  // New fields for webhook processing and frontend polling
  ready: {
    type: Boolean,
    default: false
  },
  readyAt: {
    type: Date
  },
  sessionStatus: {
    type: String
  },
  paymentStatus: {
    type: String
  },
  levelKey: {
    type: String
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { 
    type: Date, 
    default: () => Date.now() 
  },
  expiresAt: { 
    type: Date
    // TTL index is created manually in initIndexes() to avoid conflicts
  }, // auto-cleanup
}, {
  autoIndex: false // TTL indexes are created manually in initIndexes()
});

// Indexes for fast polling and lookups
// These dramatically improve performance for the common query patterns
checkoutSessionSchema.index({ pendingUserId: 1 });                    // Fallback lookup path
checkoutSessionSchema.index({ ready: 1, status: 1 });               // Frequent polling queries
checkoutSessionSchema.index({ stripeSessionId: 1, pendingUserId: 1 }); // Compound index for $or queries

export default mongoose.model('CheckoutSession', checkoutSessionSchema); 