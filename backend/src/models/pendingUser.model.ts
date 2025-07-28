// backend/src/models/pendingUser.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPendingUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: {
    first: string;
    last: string;
  };
  avatarUrl?: string;
  levelKey: string;
  expiresAt: Date;
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
    maxlength: [30, 'Username cannot exceed 30 characters']
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
      // Expire after 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    },
    index: { expireAfterSeconds: 0 } // TTL index - documents expire when expiresAt is reached
  }
}, {
  timestamps: true,
  autoIndex: process.env.NODE_ENV !== 'test' // Disable autoIndex in test mode to avoid DB-drop races
});

const PendingUser: Model<IPendingUser> = mongoose.model<IPendingUser>('PendingUser', pendingUserSchema);
export default PendingUser; 