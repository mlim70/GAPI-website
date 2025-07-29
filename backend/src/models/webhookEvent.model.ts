import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
  status: 'processed' | 'failed';
  errorMessage?: string;
}

const webhookEventSchema = new Schema<IWebhookEvent>({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  processedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    required: true,
    enum: ['processed', 'failed'],
    default: 'processed',
  },
  errorMessage: {
    type: String,
  },
}, {
  autoIndex: true
});

// Add TTL index to automatically delete old webhook events
webhookEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export default mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema); 