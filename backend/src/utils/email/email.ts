// utils/email.ts - Updated to use Sender.net instead of Mailgun
import { senderEmailService } from './senderService';

/**
 * Send email verification email using Sender.net
 */
export async function sendVerificationEmail({
  email,
  name,
  userId,
  token,
}: {
  email: string;
  name: string;
  userId: string;
  token: string;
}) {
  console.log(`📧 sendVerificationEmail called for ${email} with userId: ${userId}`);
  
  // Check if Sender.net is configured
  if (!senderEmailService.isServiceConfigured()) {
    console.error('❌ Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendVerificationEmail({
      email,
      name,
      userId,
      token,
    });

    console.log(`✅ Verification email sent to ${email}`);
    return result;
    
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error.message);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail(email: string, name: string) {
  console.log(`📧 sendWelcomeEmail called for ${email}`);
  
  if (!senderEmailService.isServiceConfigured()) {
    console.error('❌ Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendWelcomeEmail(email, name);
    console.log(`✅ Welcome email sent to ${email}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error.message);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, name: string, userId: string, token: string) {
  console.log(`📧 sendPasswordResetEmail called for ${email}`);
  
  if (!senderEmailService.isServiceConfigured()) {
    console.error('❌ Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendPasswordResetEmail(email, name, userId, token);
    console.log(`✅ Password reset email sent to ${email}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error.message);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

/**
 * Send a custom email
 */
export async function sendCustomEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) {
  console.log(`📧 sendCustomEmail called for ${options.to}`);
  
  if (!senderEmailService.isServiceConfigured()) {
    console.error('❌ Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendCustomEmail(options);
    console.log(`✅ Custom email sent to ${options.to}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send custom email:', error.message);
    throw new Error(`Failed to send custom email: ${error.message}`);
  }
}

/**
 * Send account deletion confirmation email
 */
export async function sendAccountDeletionEmail({
  email,
  name,
  originalEmail,
  deletionDate,
  preservedData,
}: {
  email: string;
  name: string;
  originalEmail: string;
  deletionDate: Date;
  preservedData: {
    orderCount: number;
    totalSpent: number;
    subscriptionStatus: string;
  };
}) {
  console.log(`📧 sendAccountDeletionEmail called for ${email}`);
  
  if (!senderEmailService.isServiceConfigured()) {
    console.error('❌ Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendAccountDeletionEmail({
      email,
      name,
      originalEmail,
      deletionDate,
      preservedData,
    });
    
    console.log(`✅ Account deletion email sent to ${email}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send account deletion email:', error.message);
    throw new Error(`Failed to send account deletion email: ${error.message}`);
  }
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return senderEmailService.isServiceConfigured();
}

/**
 * Get email service configuration status
 */
export function getEmailServiceStatus() {
  return senderEmailService.getConfigStatus();
}

/**
 * Test tokens for debugging (development only)
 */
export const testTokens: Array<{
  email: string;
  userId: string;
  token: string;
}> = [];
