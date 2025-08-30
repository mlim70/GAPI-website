import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ICheckoutSession extends Document {
  userId: Types.ObjectId;
  stripeSessionId: string;
  mode: 'payment' | 'subscription';
  levelKey?: string;
  levelId?: Types.ObjectId;
  priceId?: string;
  stripeCustomerId?: string;
  paymentIntentId?: string;   // one-time canonical key
  stripeSubscriptionId?: string;    // recurring canonical key - Stripe subscription ID
  status: 'CREATED' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  ready: boolean;
  readyAt?: Date;
  expiresAt?: Date;
  verifyNonce: string;

  createdAt: Date;
  updatedAt: Date;
}

const checkoutSessionSchema = new Schema<ICheckoutSession>({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stripeSessionId:  { type: String, required: true }, // unique index below
  mode:             { type: String, enum: ['payment', 'subscription'], required: true, index: true },
  levelKey:         { type: String },
  levelId:          { type: Schema.Types.ObjectId, ref: 'MembershipLevel' },
  priceId:          { type: String, index: true },
  stripeCustomerId: { type: String, index: true },

  paymentIntentId:  { type: String }, // unique+sparse index below
  stripeSubscriptionId:   { type: String }, // unique+sparse index below

  status: { 
    type: String, 
    enum: ['CREATED', 'EXPIRED', 'COMPLETED', 'CANCELLED'], 
    default: 'CREATED',
    index: true
  },

  ready:   { type: Boolean, default: false, index: true },
  readyAt: { type: Date },

  // TTL cleanup (index below)
  expiresAt:   { type: Date },

  verifyNonce: { type: String, required: true },
}, { 
  timestamps: true,
  strict: true,
  autoIndex: false,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.verifyNonce; // don’t leak to clients
      return ret;
    }
  }
});

// ---- Indexes ----
// Hard uniqueness
checkoutSessionSchema.index({ stripeSessionId: 1 }, { unique: true }); // removed sparse

// Canonical lookup keys: unique when present
checkoutSessionSchema.index({ paymentIntentId: 1 }, { unique: true, sparse: true });
checkoutSessionSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });

// Useful compound (kept)
checkoutSessionSchema.index({ userId: 1, createdAt: -1 });
checkoutSessionSchema.index({ userId: 1, mode: 1, createdAt: -1 });
checkoutSessionSchema.index({ stripeCustomerId: 1, mode: 1 });

// TTL: delete when expiresAt is reached
checkoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Guardrails: prevent cross‑contamination of keys based on mode
checkoutSessionSchema.pre('save', function(next) {
  if (this.mode === 'payment' && this.stripeSubscriptionId) {
    return next(new Error('stripeSubscriptionId should not be set for mode=payment'));
  }
  if (this.mode === 'subscription' && this.paymentIntentId) {
    // For recurring, PI belongs to invoice; CS PI should remain empty
    return next(new Error('paymentIntentId should not be set for mode=subscription'));
  }
  next();
});

const CheckoutSession: Model<ICheckoutSession> =
  mongoose.models.CheckoutSession ||
  mongoose.model<ICheckoutSession>('CheckoutSession', checkoutSessionSchema);

export default CheckoutSession;
