import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt?: Date; // Optional - only set on success
  status: 'processing' | 'processed' | 'failed';
  errorMessage?: string;
  claimed: boolean;
  claimedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>({
  eventId: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  processedAt: {
    type: Date,
    // Optional - only set when processing succeeds
  },
  status: {
    type: String,
    required: true,
    enum: ['processing', 'processed', 'failed'],
    default: 'processing',
  },
  errorMessage: {
    type: String,
  },
  // Claim fields to prevent duplicate webhook processing
  claimed: {
    type: Boolean,
    default: false
  },
  claimedAt: {
    type: Date
  }
}, {
  autoIndex: false
});

export default mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema); 