// backend/src/models/user.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { createUTCDate } from '../utils/dateUtils';
import isEmail from 'validator/lib/isEmail.js';

export interface IUser extends Document {
  // Core Identity
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  
  // Account Status & Lifecycle
  status: 'ACTIVE' | 'DELETED' | 'REFUNDED' | 'PENDING_VERIFICATION' | 'VERIFIED_PENDING_PAYMENT';
  statusReason?: string;
  deletedAt?: Date;
  refundedAt?: Date;
  
  // Authentication & Security
  passwordHash: string;
  passwordUpdatedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  
  // Email Verification
  emailVerified?: boolean;
  verifiedAt?: Date;
  verificationTokenHash?: string;
  verificationTokenExpires?: Date;
  
  // Membership & Business Logic
  membershipLevel?: string;
  signupIntent?: {
    levelKey: string;
    createdAt: Date;
    expiresAt: Date;
  };
  
  // Third-party Integration
  stripeCustomerId?: string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  // Core Identity
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
  username: { 
    type: String, 
    required: true, 
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    validate: {
      validator: function(v: string) {
        // Allow alphanumeric characters, hyphens, and underscores
        // Must start with a letter or number (not hyphen or underscore)
        return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(v);
      },
      message: 'Username can only contain letters, numbers, hyphens, and underscores, and must start with a letter or number'
    }
  },
  name: {
    first: { 
      type: String, 
      required: true,
      minlength: [1, 'First name is required'],
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    last: { 
      type: String, 
      required: true,
      minlength: [1, 'Last name is required'],
      maxlength: [50, 'Last name cannot exceed 50 characters']
    }
  },
  
  // Account Status & Lifecycle
  status: { 
    type: String, 
    enum: ['ACTIVE', 'DELETED', 'REFUNDED', 'PENDING_VERIFICATION', 'VERIFIED_PENDING_PAYMENT'],
    default: 'PENDING_VERIFICATION',
    required: true 
  },
  statusReason: { type: String },
  deletedAt: { type: Date },
  refundedAt: { type: Date },
  
  // Authentication & Security
  passwordHash: { type: String, required: true, select: false },
  passwordUpdatedAt: { 
    type: Date, 
    default: function() {
      return createUTCDate();
    }
  },
  resetTokenHash: {
    type: String,
    select: false
  },
  resetTokenExpires: {
    type: Date,
    select: false
  },
  
  // Email Verification
  emailVerified: { 
    type: Boolean, 
    default: false 
  },
  verifiedAt: { 
    type: Date
  },
  verificationTokenHash: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  
  // Membership & Business Logic
  membershipLevel: { 
    type: String,
    required: false
  },
  signupIntent: {
    levelKey: {
      type: String,
      required: function (this: IUser) {
        return this.status === 'PENDING_VERIFICATION' || this.status === 'VERIFIED_PENDING_PAYMENT';
      }
    },
    createdAt: {
      type: Date,
      required: function(this: IUser) {
        return this.status === 'VERIFIED_PENDING_PAYMENT';
      },
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: function(this: IUser) {
        return this.status === 'VERIFIED_PENDING_PAYMENT';
      }
    }
  },
  
  // Third-party Integration
  stripeCustomerId: { 
    type: String, 
    sparse: true 
  }
}, {
  timestamps: true,
  autoIndex: false
});

// Pre-save hook to update passwordUpdatedAt when passwordHash changes
userSchema.pre('save', function(next) {
  if (this.isModified('passwordHash')) {
    this.passwordUpdatedAt = new Date();
  }
  next();
});

// Note: Indexes are now created manually in initIndexes.ts to avoid conflicts

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User; 