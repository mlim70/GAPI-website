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
    unique: true, // TODO: comment out for testing
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
    type: Date, 
    index: { expireAfterSeconds: 86400 } // 24 hours = 86400 seconds
  }, // auto-cleanup
}, {
  autoIndex: process.env.NODE_ENV !== 'test' // Disable autoIndex in test mode to avoid DB-drop races
});

export default mongoose.model('CheckoutSession', checkoutSessionSchema); 