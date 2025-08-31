// utils/email.ts
import { senderEmailService } from './senderService';
import { logger } from '../general/logger';

/**
 * Send email verification email using Sender.net
 */
export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  logger.debug('sendVerificationEmail called for', email);
  
  // Check if Sender.net is configured
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendVerificationEmail({
      email,
      name,
      token,
    });

    logger.debug('Verification email sent to', email);
    return result;
    
  } catch (error: any) {
    logger.error('Failed to send verification email:', error.message);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail(email: string, name: string) {
  logger.debug('sendWelcomeEmail called for', email);
  
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendWelcomeEmail(email, name);
    logger.debug('Welcome email sent to', email);
    return result;
  } catch (error: any) {
    logger.error('Failed to send welcome email:', error.message);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, name: string, userId: string, token: string) {
  logger.debug('sendPasswordResetEmail called for', email);
  
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendPasswordResetEmail(email, name, userId, token);
    logger.debug('Password reset email sent to', email);
    return result;
  } catch (error: any) {
    logger.error('Failed to send password reset email:', error.message);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

/**
 * Send password change notification email
 */
export async function sendPasswordChangeEmail({
  email,
  name,
  changeTimestamp,
  ipAddress,
  location,
  userAgent,
}: {
  email: string;
  name: string;
  changeTimestamp: Date;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
}) {
  logger.debug('sendPasswordChangeEmail called for', email);
  
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendPasswordChangeEmail({
      email,
      name,
      changeTimestamp,
      ipAddress,
      location,
      userAgent,
    });

    logger.debug('Password change email sent to', email);
    return result;
    
  } catch (error: any) {
    logger.error('Failed to send password change email:', error.message);
    throw new Error(`Failed to send password change email: ${error.message}`);
  }
}

/**
 * Send contact form email using transactional template
 */
export async function sendContactFormEmail(formData: {
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
}) {
  logger.debug('sendContactFormEmail called for', formData.email);
  
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendContactFormEmail(formData);
    logger.debug('Contact form email sent successfully');
    return result;
  } catch (error: any) {
    logger.error('Failed to send contact form email:', error.message);
    throw new Error(`Failed to send contact form email: ${error.message}`);
  }
}

/**
 * Send account deletion confirmation email
 */
export async function sendAccountDeletionEmail({
  email,
  name,
  deletionDate,
  preservedData,
}: {
  email: string;
  name: string;
  deletionDate: Date;
  preservedData: {
    subscriptionStatus: string;
  };
}) {
  logger.debug('sendAccountDeletionEmail called for', email);
  
  if (!senderEmailService.isServiceConfigured()) {
    logger.error('Sender.net not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY and SENDER_DOMAIN are required');
  }

  try {
    const result = await senderEmailService.sendAccountDeletionEmail({
      email,
      name,
      deletionDate,
      preservedData,
    });
    
    logger.debug('Account deletion email sent to', email);
    return result;
  } catch (error: any) {
    logger.error('Failed to send account deletion email:', error.message);
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
