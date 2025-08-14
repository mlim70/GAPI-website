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
    enum: ['CREATED', 'COMPLETED', 'EXPIRED'], 
    default: 'CREATED' 
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

export default mongoose.model('CheckoutSession', checkoutSessionSchema); 