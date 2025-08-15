// backend/src/models/order.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import isEmail from 'validator/lib/isEmail.js';

export interface IOrder extends Document {
  userId: Types.ObjectId; // O-1: Add userId for one-time purchases/refunds
  subscriptionId?: Types.ObjectId; // Nullable for one-time purchases
  membershipLevelId: Types.ObjectId;
  gatewayPaymentId?: string | null; // For ONE_TIME orders only
  gatewayInvoiceId?: string | null; // For recurring orders only
  totalCents: number; // O-2: Store money as integer cents
  currency: string;
  billing: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      line1: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
    };
  };
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt: Date;
  refundedAt?: Date;
}

const orderSchema: Schema<IOrder> = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // O-1: Add userId
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: false },
  membershipLevelId: { type: Schema.Types.ObjectId, ref: 'MembershipLevel', required: true },
  gatewayPaymentId: { 
    type: String, 
    default: null, 
    sparse: true,
    validate: {
      validator: function(v: string | null) {
        if (!v) return true; // Allow null/undefined
        // Allow Stripe ids OR internal/free ids
        return /^(pi_|cs_|ch_|sub_|in_|free_|int_)[a-zA-Z0-9:_-]+$/.test(v);
      },
      message: 'Gateway Payment ID must start with pi_, cs_, ch_, sub_, in_, free_, or int_'
    }
  },
  gatewayInvoiceId: { 
    type: String, 
    default: null, 
    sparse: true,
    validate: {
      validator: function(v: string | null) {
        if (!v) return true; // Allow null/undefined
        // Allow Stripe invoice ids OR internal ids
        return /^(in_|int_)[a-zA-Z0-9:_-]+$/.test(v);
      },
      message: 'Gateway Invoice ID must start with in_ or int_'
    }
  },
  totalCents: { 
    type: Number, 
    required: true,
    min: [0, 'Total must be non-negative'],
    validate: {
      validator: function(v: number) {
        return Number.isInteger(v);
      },
      message: 'Total must be an integer (cents)'
    }
  }, // O-2: Store money as integer cents
  currency: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^[a-z]{3}$/.test(v);
      },
      message: 'Currency must be a 3-letter ISO code (e.g., usd, eur)'
    }
  },
  billing: {
    name: { 
      type: String, 
      required: true,
      minlength: [1, 'Billing name is required'],
      maxlength: [100, 'Billing name cannot exceed 100 characters']
    },
    email: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v: string) {
          return isEmail(v);
        },
        message: 'Please provide a valid email address'
      }
    },
    phone: { 
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Allow empty
          return /^[\+]?[1-9][\d]{0,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
        },
        message: 'Please provide a valid phone number'
      }
    },
    address: {
      line1: { 
        type: String,
        maxlength: [100, 'Address line 1 cannot exceed 100 characters']
      },
      city: { 
        type: String,
        maxlength: [50, 'City cannot exceed 50 characters']
      },
      region: { 
        type: String,
        maxlength: [50, 'Region cannot exceed 50 characters']
      },
      postalCode: { 
        type: String,
        maxlength: [20, 'Postal code cannot exceed 20 characters']
      },
      country: { 
        type: String,
        maxlength: [50, 'Country cannot exceed 50 characters']
      },
    },
  },
  status: { 
    type: String, 
    enum: ['COMPLETED', 'FAILED', 'REFUNDED'], 
    required: true 
  },
  paidAt: { type: Date, required: true },
  refundedAt: { type: Date },
}, {
  timestamps: true, // O-3: Enable timestamps:true
  autoIndex: false
});

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
export default Order; 