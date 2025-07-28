// backend/src/models/membershipLevel.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IMembershipLevel extends Document {
  key:           string;  // e.g. "life", "student"
  name:          string;  // from Stripe.Product.name
  description?:  string;  // from Stripe.Product.description
  stripePriceId: string;  // the Stripe Price ID
  isRecurring:   boolean; // whether this is a subscription or one-time payment
  // Cached Stripe pricing fields
  unitAmount:    number;  // price in cents
  currency:      string;  // e.g. "usd"
  interval?:     string;  // e.g. "month", "year" for recurring plans
  intervalCount?: number; // e.g. 1, 3, 6 for "every X months"
  // M-2: Status enum
  status:        'ACTIVE' | 'ARCHIVED';
}

const membershipLevelSchema = new Schema<IMembershipLevel>({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: [1, 'Key is required'],
    maxlength: [50, 'Key cannot exceed 50 characters']
  },
  name: { 
    type: String, 
    required: true,
    minlength: [1, 'Name is required'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: { 
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  stripePriceId: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v: string) {
        return /^price_[a-zA-Z0-9]+$/.test(v);
      },
      message: 'Stripe Price ID must be in the format price_xxxxxxxxxxxxx'
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
        return ['day', 'week', 'month', 'year'].includes(v);
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
    default: 'ACTIVE', 
    index: true 
  },
}, {
  timestamps: true // M-3: Enable timestamps:true
});

export default mongoose.model<IMembershipLevel>(
  'MembershipLevel',
  membershipLevelSchema
); 