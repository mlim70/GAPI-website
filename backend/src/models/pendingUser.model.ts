// backend/src/models/pendingUser.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { createUTCDate } from '../utils/dateUtils';
import isEmail from 'validator/lib/isEmail.js';

export interface IPendingUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: {
    first: string;
    last: string;
  };
  levelKey: string;
  expiresAt: Date;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationTokenExpires?: Date;
  membershipLevel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pendingUserSchema: Schema<IPendingUser> = new mongoose.Schema({
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
  levelKey: { 
    type: String, 
    required: true,
    minlength: [1, 'Level key is required'],
    maxlength: [50, 'Level key cannot exceed 50 characters']
  },
  expiresAt: { 
    type: Date, 
    required: true,
    default: function() {
      // Use UTC dates for consistency - expire after 24 hours
      return createUTCDate(24);
    }
    // TTL index is created manually in initIndexes() to avoid conflicts
  },
  emailVerified: { 
    type: Boolean, 
    default: false 
  },
  emailVerificationTokenHash: { 
    type: String 
  },
  emailVerificationTokenExpires: { 
    type: Date 
  },
  membershipLevel: { 
    type: String,
    required: false
  }
}, {
  timestamps: true,
  autoIndex: false // TTL indexes are created manually in initIndexes()
});

// Add case-insensitive collation for username uniqueness
pendingUserSchema.index({ username: 1 }, { 
  unique: true, 
  collation: { locale: 'en', strength: 2 },
  name: 'username_case_insensitive_1'
});

const PendingUser: Model<IPendingUser> = mongoose.model<IPendingUser>('PendingUser', pendingUserSchema);
export default PendingUser; 