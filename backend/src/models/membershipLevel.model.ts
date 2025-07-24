// backend/src/models/membershipLevel.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IMembershipLevel extends Document {
  key: string;
  name: string;
  price: number;
  currency: string;
  interval: {
    unit: 'DAY' | 'MONTH' | 'YEAR';
    count: number;
  };
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipLevelSchema: Schema<IMembershipLevel> = new mongoose.Schema({
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

const MembershipLevel: Model<IMembershipLevel> = mongoose.model<IMembershipLevel>('MembershipLevel', membershipLevelSchema);
export default MembershipLevel; 