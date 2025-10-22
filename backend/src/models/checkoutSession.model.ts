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
  verifyNonce?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface ICheckoutSessionModel extends Model<ICheckoutSession> {
  updateOneWithValidation(filter: any, update: any, options?: any): Promise<any>;
  findOneAndUpdateWithValidation(filter: any, update: any, options?: any): Promise<ICheckoutSession | null>;
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

  verifyNonce: { type: String, required: false },
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

// Validation function that can be called before updates
function validateCheckoutSessionMode(data: Partial<ICheckoutSession>, mode?: 'payment' | 'subscription') {
  const sessionMode = mode || data.mode;
  
  if (sessionMode === 'payment' && data.stripeSubscriptionId) {
    throw new Error('stripeSubscriptionId should not be set for mode=payment');
  }
  if (sessionMode === 'subscription' && data.paymentIntentId) {
    // For recurring, PI belongs to invoice; CS PI should remain empty
    throw new Error('paymentIntentId should not be set for mode=subscription');
  }
}

// Helper function to extract update payload from $set/$unset operations
function extractUpdatePayload(update: any) {
  if (!update) return update;
  if ('$set' in update || '$unset' in update) {
    return { ...update.$set, ...update.$unset };
  }
  return update;
}

// Guardrails: prevent cross‑contamination of keys based on mode
checkoutSessionSchema.pre('save', function(next) {
  try {
    validateCheckoutSessionMode(this);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Add validation for findOneAndUpdate operations
checkoutSessionSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const raw = this.getUpdate() as any;
    const payload = extractUpdatePayload(raw);
    const query = this.getQuery();
    
    // Get the mode from the update payload or existing document
    let mode = payload.mode;
    if (!mode) {
      const existingDoc = await this.model.findOne(query).select('mode');
      if (!existingDoc) {
        // No document found, skip validation
        return next();
      }
      mode = existingDoc.mode;
    }
    
    // Validate the unwrapped update payload
    validateCheckoutSessionMode(payload, mode);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Add validation for updateOne operations
checkoutSessionSchema.pre('updateOne', async function(next) {
  try {
    const raw = this.getUpdate() as any;
    const payload = extractUpdatePayload(raw);
    const query = this.getQuery();
    
    // Get the mode from the update payload or existing document
    let mode = payload.mode;
    if (!mode) {
      const existingDoc = await this.model.findOne(query).select('mode');
      if (!existingDoc) {
        // No document found, skip validation
        return next();
      }
      mode = existingDoc.mode;
    }
    
    // Validate the unwrapped update payload
    validateCheckoutSessionMode(payload, mode);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Add validation for updateMany operations
checkoutSessionSchema.pre('updateMany', async function(next) {
  try {
    const raw = this.getUpdate() as any;
    const payload = extractUpdatePayload(raw);
    const query = this.getQuery();
    
    // Get the mode from the update payload or existing document
    let mode = payload.mode;
    if (!mode) {
      const existingDoc = await this.model.findOne(query).select('mode');
      if (!existingDoc) {
        // No document found, skip validation
        return next();
      }
      mode = existingDoc.mode;
    }
    
    // Validate the unwrapped update payload
    validateCheckoutSessionMode(payload, mode);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Add static methods that enforce validation BEFORE model compilation
checkoutSessionSchema.statics.updateOneWithValidation = async function(
  filter: any, 
  update: any, 
  options: any = {}
) {
  // Get the mode from the update or fetch from existing document
  let mode = update.$set?.mode ?? update.mode;
  if (!mode && filter._id) {
    const existing = await this.findById(filter._id).select('mode').lean();
    mode = existing?.mode;
  }
  
  // Validate the unwrapped update payload
  validateCheckoutSessionMode(extractUpdatePayload(update), mode);
  
  // Force runValidators: true and perform the update
  return this.updateOne(filter, update, { runValidators: true, ...options });
};

checkoutSessionSchema.statics.findOneAndUpdateWithValidation = async function(
  filter: any, 
  update: any, 
  options: any = {}
) {
  // Get the mode from the update or fetch from existing document
  let mode = update.$set?.mode ?? update.mode;
  if (!mode && filter._id) {
    const existing = await this.findById(filter._id).select('mode').lean();
    mode = existing?.mode;
  }
  
  // Validate the unwrapped update payload
  validateCheckoutSessionMode(extractUpdatePayload(update), mode);
  
  // Force runValidators: true and perform the update
  return this.findOneAndUpdate(filter, update, { runValidators: true, ...options });
};

// NOW compile the model
const CheckoutSession: ICheckoutSessionModel =
  (mongoose.models.CheckoutSession as ICheckoutSessionModel) ||
  mongoose.model<ICheckoutSession, ICheckoutSessionModel>('CheckoutSession', checkoutSessionSchema);

// Export validation function for use in other parts of the code
export { validateCheckoutSessionMode };

export default CheckoutSession;
