// backend/src/models/order.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import isEmail from 'validator/lib/isEmail.js';

export interface IOrder extends Document {
  userId: Types.ObjectId; // who pays (one Stripe Customer per app user)
  subscriptionId?: Types.ObjectId; // Nullable for one-time purchases
  membershipLevelId: Types.ObjectId;
  gatewayPaymentId?: string | null; // For ONE_TIME orders only (Payment Intent)
  gatewayInvoiceId?: string | null; // For recurring orders only (Invoice)
  totalCents: number; // Store money as integer cents
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
  
  // Mongoose timestamps
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema: Schema<IOrder> = new mongoose.Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    validate: {
      validator: function(v: Types.ObjectId) {
        return v && Types.ObjectId.isValid(v);
      },
      message: 'userId must be a valid ObjectId'
    }
  }, // who pays (one Stripe Customer per app user)
  subscriptionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Subscription', 
    required: false,
    validate: {
      validator: function(v: Types.ObjectId | undefined) {
        if (!v) return true; // Allow undefined/null
        return Types.ObjectId.isValid(v);
      },
      message: 'subscriptionId must be a valid ObjectId if provided'
    }
  },
  membershipLevelId: { 
    type: Schema.Types.ObjectId, 
    ref: 'MembershipLevel', 
    required: true,
    validate: {
      validator: function(v: Types.ObjectId) {
        return v && Types.ObjectId.isValid(v);
      },
      message: 'membershipLevelId must be a valid ObjectId'
    }
  },
  gatewayPaymentId: { 
    type: String, 
    validate: {
      validator: function(v: string | null | undefined) {
        if (!v) return true; // Allow null/undefined
        // Allow Stripe ids OR internal/free ids
        return /^(pi_|cs_|ch_|sub_|in_|free_|int_)[a-zA-Z0-9:_-]+$/.test(v);
      },
      message: 'Gateway Payment ID must start with pi_, cs_, ch_, sub_, in_, free_, or int_'
    }
  },
  gatewayInvoiceId: { 
    type: String, 
    validate: {
      validator: function(v: string | null | undefined) {
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
  }, // Store money as integer cents
  currency: { 
    type: String,
    lowercase: true,
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

// Pre-save middleware for business logic validation
orderSchema.pre('save', function(next) {
  const order = this as IOrder;
  
  // Normalize billing email
  if (order.billing?.email) order.billing.email = order.billing.email.trim().toLowerCase();

  // Validate that totalCents is non-negative
  if (order.totalCents < 0) {
    return next(new Error('Total amount cannot be negative'));
  }
  
  // Validate that currency is lowercase
  if (order.currency !== order.currency.toLowerCase()) {
    order.currency = order.currency.toLowerCase();
  }
  
  // Validate that paidAt is set for completed orders
  if (order.status === 'COMPLETED' && !order.paidAt) {
    order.paidAt = new Date();
  }
  
  // Validate that refundedAt is only set for refunded orders
  if (order.refundedAt && order.status !== 'REFUNDED') {
    return next(new Error('Refund date can only be set for refunded orders'));
  }
  
  next();
});

// Indexes are managed by initIndexes() - see backend/src/db/initIndexes.ts

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
export default Order; 