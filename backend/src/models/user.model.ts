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
  createdAt: Date;
  updatedAt: Date;
  membershipLevel: string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, index: true },
  username:   { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  name: {
    first:    { type: String, required: true },
    last:     { type: String, required: true }
  },
  avatarUrl:  { type: String },
  role:       { type: String, enum: ['subscriber', 'administrator'], default: 'subscriber', index: true },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
  membershipLevel: {
    type: String,
    required: true,
    index: true,
  },
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User; 