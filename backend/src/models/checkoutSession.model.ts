import mongoose from 'mongoose';

const checkoutSessionSchema = new mongoose.Schema({
  pendingUserId: { 
    type: mongoose.Types.ObjectId, 
    ref: 'PendingUser', 
    required: false 
  },
  pendingUserEmail: {
    type: String,
    required: false,
  },
  stripeSessionId: { 
    type: String, 
    required: false 
  },
  status: { 
    type: String, 
    enum: ['CREATED', 'COMPLETED', 'EXPIRED'], 
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
  completedAt: {
    type: Date
  },
  stripeSessionStatus: {
    type: String
  },
  stripePaymentStatus: {
    type: String
  },
  levelKey: {
    type: String
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: 'User'
  },
  // Finalization lock fields to prevent duplicate finalization
  finalizing: {
    type: Boolean,
    default: false
  },
  finalizingAt: {
    type: Date
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
  autoIndex: false
});

export default mongoose.model('CheckoutSession', checkoutSessionSchema); 