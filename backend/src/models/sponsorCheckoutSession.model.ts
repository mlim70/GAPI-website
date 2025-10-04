import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISponsorCheckoutSession extends Document {
  sponsorId: Types.ObjectId;
  stripeSessionId: string;
  verifyNonce: string;
  status: 'CREATED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sponsorCheckoutSessionSchema = new Schema<ISponsorCheckoutSession>({
  sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor', required: true, index: true },
  stripeSessionId: { type: String, required: true, unique: true, index: true },
  verifyNonce: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['CREATED', 'COMPLETED', 'EXPIRED', 'CANCELLED'], 
    default: 'CREATED',
    index: true
  },
  expiresAt: { type: Date, required: true, index: true }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
sponsorCheckoutSessionSchema.index({ stripeSessionId: 1, verifyNonce: 1 });
sponsorCheckoutSessionSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model<ISponsorCheckoutSession>('SponsorCheckoutSession', sponsorCheckoutSessionSchema);
