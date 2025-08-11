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
    //unique: true, // TODO: Comment out for testing - can cause conflicts with placeholder 'PENDING' StripeSessionID
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
  autoIndex: true
});

export default mongoose.model('CheckoutSession', checkoutSessionSchema); 