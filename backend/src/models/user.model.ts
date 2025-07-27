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
  role: 'subscriber' | 'administrator';
  stripeSessionId?: string;
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
  role: { 
    type: String, 
    enum: ['subscriber', 'administrator'], 
    default: 'subscriber', 
    index: true 
  },
  stripeSessionId: { 
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values but ensures uniqueness for non-null values
    index: true
  },
}, {
  timestamps: true
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User; 