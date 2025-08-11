// backend/src/models/user.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: {
    first: string;
    last: string;
  };
  avatarUrl?: string;
  membershipLevel?: string;
  emailVerified?: boolean;
  verifiedAt?: Date;
  passwordUpdatedAt?: Date;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
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
  avatarUrl: { 
    type: String,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Allow empty
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Avatar URL must be a valid HTTP/HTTPS URL'
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
    type: Date 
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