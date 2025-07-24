import mongoose from 'mongoose';

const membershipLevelSchema = new mongoose.Schema({
  key:        { type: String, required: true, unique: true, index: true },
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  currency:   { type: String, required: true },
  interval: {
    unit:     { type: String, enum: ['DAY', 'MONTH', 'YEAR'], required: true },
    count:    { type: Number, required: true }
  },
  isRecurring: { type: Boolean, required: true },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

export default mongoose.model('MembershipLevel', membershipLevelSchema); 