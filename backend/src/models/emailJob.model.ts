//backend/src/models/emailJob.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailJob extends Document {
  type: 'welcome' | 'passwordReset' | 'contactForm' | 'verification'; // Only implemented email types
  priority: 'high' | 'medium' | 'low'; // Priority for processing
  priorityWeight: number; // Numeric weight for sorting: high=3, medium=2, low=1
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recipient: {
    email: string;
    name?: string;
  };
  data: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailJobSchema = new Schema<IEmailJob>({
  type: {
    type: String,
    required: true,
    enum: ['welcome', 'passwordReset', 'contactForm', 'verification'], // Only implemented types
    default: 'welcome',
  },
  priority: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  priorityWeight: {
    type: Number,
    default: 2, // medium priority default
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  recipient: {
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: String,
  },
  data: {
    type: Schema.Types.Mixed,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  nextAttemptAt: Date,
  processedAt: Date,
  errorMessage: String,
}, {
  timestamps: true,
});

// Pre-validate hook to automatically set priorityWeight based on priority
emailJobSchema.pre('validate', function(next) {
  this.priorityWeight = this.priority === 'high' ? 3 : this.priority === 'low' ? 1 : 2;
  next();
});

const EmailJob = mongoose.model<IEmailJob>('EmailJob', emailJobSchema);

export default EmailJob;
