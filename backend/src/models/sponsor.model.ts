import mongoose, { Document, Schema } from 'mongoose';

export interface ISponsor extends Document {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  tierName?: string;
  amount: number; // Amount in cents
  stripeCustomerId?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

const sponsorSchema = new Schema<ISponsor>({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  company: { type: String, trim: true },
  phone: { type: String, trim: true },
  message: { type: String, trim: true },
  tierName: { type: String, trim: true },
  amount: { type: Number, required: true, min: 0 },
  stripeCustomerId: { type: String, sparse: true, index: true },
  stripeSessionId: { type: String, sparse: true, index: true },
  stripePaymentIntentId: { type: String, sparse: true, index: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'], 
    default: 'PENDING',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
sponsorSchema.index({ email: 1, createdAt: -1 });
sponsorSchema.index({ status: 1, createdAt: -1 });
sponsorSchema.index({ stripeSessionId: 1 }, { unique: true, sparse: true });

export default mongoose.model<ISponsor>('Sponsor', sponsorSchema);
