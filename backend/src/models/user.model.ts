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
  passwordUpdatedAt?: Date;
  // Password reset fields
  resetToken?: string;
  resetTokenExpires?: Date;
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: Date;
  originalEmail?: string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
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
    unique: true, 
    index: true,
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
  passwordHash: { type: String, required: true },
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
    required: false,
    index: true
  },
  emailVerified: { 
    type: Boolean, 
    default: false 
  },
  verifiedAt: { 
    type: Date
  },
  passwordUpdatedAt: { 
    type: Date,
    default: function() {
      return createUTCDate();
    }
  },
  // Password reset fields
  resetToken: {
    type: String
  },
  resetTokenExpires: {
    type: Date,
    default: function() {
      return createUTCDate(1); // 1 hour from now in UTC
    }
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
  }
}, {
  timestamps: true,
  autoIndex: true
});

// Add case-insensitive collation for username uniqueness
userSchema.index({ username: 1 }, { 
  unique: true, 
  collation: { locale: 'en', strength: 2 },
  name: 'username_case_insensitive_1'
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User; 