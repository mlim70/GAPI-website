//backend/src/email/emailQueue.ts
import EmailJob from '../../models/emailJob.model';

export interface EmailJobData {
  type: 'welcome' | 'passwordReset' | 'contactForm' | 'verification';
  priority?: 'high' | 'medium' | 'low';
  recipient: {
    email: string;
    name?: string;
  };
  data: Record<string, any>;
}

/**
 * Queue an email job for background processing
 * This function returns immediately without waiting for the email to be sent
 */
export async function queueEmailJob(jobData: EmailJobData): Promise<void> {
  try {
    await EmailJob.create({
      type: jobData.type,
      priority: jobData.priority || 'medium',
      recipient: jobData.recipient,
      data: jobData.data,
      status: 'pending',
      nextAttemptAt: new Date(), // Process immediately
    });
    
    console.log(`📧 Email job queued: ${jobData.type} (${jobData.priority || 'medium'} priority) to ${jobData.recipient.email}`);
  } catch (error) {
    console.error('❌ Failed to queue email job:', error);
    // Don't throw - we don't want to fail the webhook if queueing fails
  }
}

/**
 * Queue a welcome email job
 */
export async function queueWelcomeEmail(email: string, fullName: string): Promise<void> {
  await queueEmailJob({
    type: 'welcome',
    priority: 'high', // Welcome emails are high priority
    recipient: {
      email,
      name: fullName,
    },
    data: {
      fullName,
    },
  });
}

/**
 * Queue a password reset email job
 */
export async function queuePasswordResetEmail(email: string, fullName: string, userId: string, resetToken: string): Promise<void> {
  await queueEmailJob({
    type: 'passwordReset',
    priority: 'high', // Password resets are high priority
    recipient: { 
      email,
      name: fullName 
    },
    data: {
      fullName,
      userId,
      token: resetToken,
    },
  });
}

/**
 * Queue a contact form email job
 */
export async function queueContactFormEmail(formData: {
  email: string;
  name: string;
  subject: string;
  message: string;
}): Promise<void> {
  await queueEmailJob({
    type: 'contactForm',
    priority: 'medium', // Contact forms are medium priority
    recipient: {
      email: formData.email,
      name: formData.name,
    },
    data: {
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      submittedAt: new Date(),
    },
  });
}

/**
 * Queue a verification email job
 */
export async function queueVerificationEmail(email: string, fullName: string, userId: string, verificationToken: string): Promise<void> {
  await queueEmailJob({
    type: 'verification',
    priority: 'high', // Verifications are high priority
    recipient: {
      email,
      name: fullName,
    },
    data: {
      fullName,
      userId,
      token: verificationToken,
    },
  });
}


