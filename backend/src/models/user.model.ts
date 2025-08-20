// backend/src/models/user.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { createUTCDate } from '../utils/dateUtils';
import isEmail from 'validator/lib/isEmail.js';

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: {
    first: string;
    last: string;
  };
  membershipLevel?: string;
  emailVerified?: boolean;
  verifiedAt?: Date;
  verificationTokenHash?: string;
  verificationTokenExpires?: Date;
  signupIntent?: {
    levelKey: string;
    createdAt: Date;
    expiresAt: Date;
  };
  passwordUpdatedAt?: Date;
  // Password reset fields
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: Date;
  originalEmail?: string;
  // Stripe integration
  stripeCustomerId?: string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
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
  passwordHash: { type: String, required: true, select: false },
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
  membershipLevel: { 
    type: String,
    required: false
  },
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
  signupIntent: {
    levelKey: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  passwordUpdatedAt: { 
    type: Date,
    default: function() {
      return createUTCDate();
    }
  },
  // Password reset fields
  resetTokenHash: {
    type: String,
    select: false
  },
  resetTokenExpires: {
    type: Date,
    select: false
  },
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  originalEmail: {
    type: String
  },
  // Stripe integration
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