// utils/email.ts - Updated to use Mailgun instead of Sender.net
import 'dotenv/config';
import { mailgunEmailService } from './mailgunService';

/**
 * Send email verification email using Mailgun
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
  
  // Check if Mailgun is configured
  if (!mailgunEmailService.isServiceConfigured()) {
    console.error('❌ Mailgun not configured - email functionality is disabled');
    throw new Error('Email service not configured - MAILGUN_API_KEY and MAILGUN_DOMAIN are required');
  }

  try {
    const result = await mailgunEmailService.sendVerificationEmail({
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
  
  if (!mailgunEmailService.isServiceConfigured()) {
    console.error('❌ Mailgun not configured - email functionality is disabled');
    throw new Error('Email service not configured - MAILGUN_API_KEY and MAILGUN_DOMAIN are required');
  }

  try {
    const result = await mailgunEmailService.sendWelcomeEmail(email, name);
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
export async function sendPasswordResetEmail(email: string, name: string, userId: string) {
  console.log(`📧 sendPasswordResetEmail called for ${email}`);
  
  if (!mailgunEmailService.isServiceConfigured()) {
    console.error('❌ Mailgun not configured - email functionality is disabled');
    throw new Error('Email service not configured - MAILGUN_API_KEY and MAILGUN_DOMAIN are required');
  }

  try {
    const result = await mailgunEmailService.sendPasswordResetEmail(email, name, userId);
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
  
  if (!mailgunEmailService.isServiceConfigured()) {
    console.error('❌ Mailgun not configured - email functionality is disabled');
    throw new Error('Email service not configured - MAILGUN_API_KEY and MAILGUN_DOMAIN are required');
  }

  try {
    const result = await mailgunEmailService.sendEmail(options);
    console.log(`✅ Custom email sent to ${options.to}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send custom email:', error.message);
    throw new Error(`Failed to send custom email: ${error.message}`);
  }
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return mailgunEmailService.isServiceConfigured();
}

/**
 * Get email service configuration status
 */
export function getEmailServiceStatus() {
  return mailgunEmailService.getConfigStatus();
}

/**
 * Test tokens for debugging (development only)
 */
export const testTokens: Array<{
  email: string;
  userId: string;
  token: string;
}> = [];
