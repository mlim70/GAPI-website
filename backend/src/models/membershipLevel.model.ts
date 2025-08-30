// backend/src/models/membershipLevel.model.ts
import mongoose, { Document, Schema } from 'mongoose';
import isIn from 'validator/lib/isIn.js';

export interface IMembershipLevel extends Document {
  key:            string;  // e.g. "lifetime_membership", "student_plan" - human-readable identifier used by frontend
  description?:   string;  // from Stripe.Product.description
  stripePriceId:  string;  // the Stripe Price ID - primary identifier
  stripeProductId: string; // the Stripe Product ID - for product-level operations
  isRecurring:    boolean; // whether this is a subscription or one-time payment
  // Cached Stripe pricing fields
  unitAmount:     number;  // price in cents
  currency:       string;  // e.g. "usd"
  interval?:      string;  // e.g. "month", "year" for recurring plans
  intervalCount?: number;  // e.g. 1, 3, 6 for "every X months"
  // M-2: Status enum
  status:         'ACTIVE' | 'ARCHIVED';
  
  // Mongoose timestamps
  createdAt: Date;
  updatedAt: Date;
}

const membershipLevelSchema = new Schema<IMembershipLevel>({
  key: { 
    type: String, 
    required: true, // Required for frontend compatibility
    unique: false,  // Not unique since we use Stripe IDs as primary identifiers
    minlength: [1, 'Key must be at least 1 character'],
    maxlength: [100, 'Key cannot exceed 100 characters']
  },
  description: { 
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  stripePriceId: { 
    type: String, 
    required: true, 
    validate: {
      validator: function(v: string) {
        return /^price_[a-zA-Z0-9]+$/.test(v);
      },
      message: 'Stripe Price ID must be in the format price_xxxxxxxxxxxxx'
    }
  },
  stripeProductId: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^prod_[a-zA-Z0-9]+$/.test(v);
      },
      message: 'Stripe Product ID must be in the format prod_xxxxxxxxxxxxx'
    }
  },
  isRecurring: { type: Boolean, required: true, default: false },
  // M-1: Cached Stripe pricing fields
  unitAmount: { 
    type: Number, 
    required: true,
    min: [0, 'Unit amount must be non-negative'],
    validate: {
      validator: function(v: number) {
        return Number.isInteger(v);
      },
      message: 'Unit amount must be an integer (cents)'
    }
  },
  currency: { 
    type: String, 
    required: true, 
    default: 'usd',
    validate: {
      validator: function(v: string) {
        return /^[a-z]{3}$/.test(v);
      },
      message: 'Currency must be a 3-letter ISO code (e.g., usd, eur)'
    }
  },
  interval: { 
    type: String,
          validate: {
        validator: function(v: string) {
          if (!v) return true; // Allow empty for non-recurring
          return isIn(v, ['day', 'week', 'month', 'year']);
        },
        message: 'Interval must be one of: day, week, month, year'
      }
  },
  intervalCount: { 
    type: Number,
    min: [1, 'Interval count must be at least 1'],
    validate: {
      validator: function(v: number) {
        if (!v) return true; // Allow empty for non-recurring
        return Number.isInteger(v) && v > 0;
      },
      message: 'Interval count must be a positive integer'
    }
  },
  // M-2: Status enum
  status: { 
    type: String, 
    enum: ['ACTIVE', 'ARCHIVED'], 
    default: 'ACTIVE'
  },
}, {
  timestamps: true, // M-3: Enable timestamps:true
  autoIndex: false
});

// ---- Indexes / constraints ----
// Enforce uniqueness on Stripe IDs
membershipLevelSchema.index({ stripePriceId: 1 }, { unique: true });
membershipLevelSchema.index({ stripeProductId: 1 }, { unique: true });
membershipLevelSchema.index({ status: 1, key: 1 }); // handy for listings

// Normalize currency to lowercase
membershipLevelSchema.pre('save', function(next) {
  if (this.currency) this.currency = this.currency.toLowerCase();
  next();
});

export default mongoose.model<IMembershipLevel>(
  'MembershipLevel',
  membershipLevelSchema
); 