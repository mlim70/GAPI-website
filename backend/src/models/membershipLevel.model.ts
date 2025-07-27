// backend/src/models/membershipLevel.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IMembershipLevel extends Document {
  key:           string;  // e.g. "life", "student"
  name:          string;  // from Stripe.Product.name
  description?:  string;  // from Stripe.Product.description
  stripePriceId: string;  // the Stripe Price ID
  isRecurring:   boolean; // whether this is a subscription or one-time payment
}

const membershipLevelSchema = new Schema<IMembershipLevel>({
  key:           { type: String, required: true, unique: true },
  name:          { type: String, required: true },
  description:   { type: String },
  stripePriceId: { type: String, required: true, unique: true },
  isRecurring:   { type: Boolean, required: true, default: false },
});

export default mongoose.model<IMembershipLevel>(
  'MembershipLevel',
  membershipLevelSchema
); 