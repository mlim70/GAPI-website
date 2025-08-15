import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
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
    required: true,
    default: Date.now,
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

// TTL index is created manually in initIndexes() to avoid conflicts

export default mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema); 