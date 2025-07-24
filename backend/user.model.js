import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
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
  updatedAt:  { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema); 