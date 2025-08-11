// Mailgun email service for GAPI
import 'dotenv/config';
import { generateVerificationToken } from '../accounts/tokens';
import crypto from 'crypto';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

interface VerificationEmailParams {
  email: string;
  name: string;
  userId: string;
}

class MailgunEmailService {
  private mg: any = null;
  private domain: string;
  private apiKey: string;
  private isConfigured: boolean = false;

  constructor() {
    this.apiKey = process.env.MAILGUN_API_KEY || '';
    this.domain = process.env.MAILGUN_DOMAIN || '';
    this.isConfigured = !!(this.apiKey && this.domain);
    
    if (!this.isConfigured) {
      console.warn('⚠️ Mailgun not configured - email functionality will be disabled');
      console.warn('   Please set MAILGUN_API_KEY and MAILGUN_DOMAIN in your .env file');
    }
  }

  private async initializeClient() {
    if (this.mg) return this.mg;

    try {
      // Dynamic imports for ES modules
      const formData = (await import('form-data')).default;
      const Mailgun = (await import('mailgun.js')).default;

      this.mg = new Mailgun(formData).client({
        username: 'api',
        key: this.apiKey,
      });

      console.log('✅ Mailgun client initialized');
      return this.mg;
    } catch (error) {
      console.error('❌ Failed to initialize Mailgun client:', error);
      throw new Error('Failed to initialize Mailgun client');
    }
  }

  /**
   * Send a basic email
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    if (!this.isConfigured) {
      throw new Error('Mailgun not configured - please set MAILGUN_API_KEY and MAILGUN_DOMAIN');
    }

    try {
      const mg = await this.initializeClient();
      
      const emailData: any = {
        from: options.from || `GAPI <no-reply@${this.domain}>`,
        to: options.to,
        subject: options.subject,
      };

      // Add content (prefer HTML over text)
      if (options.html) {
        emailData.html = options.html;
      } else if (options.text) {
        emailData.text = options.text;
      } else {
        throw new Error('Either text or HTML content is required');
      }

      const result = await mg.messages.create(this.domain, emailData);
      
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`   Message ID: ${result.id}`);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

    /**
   * Send email verification email
   */
   async sendVerificationEmail(params: VerificationEmailParams): Promise<any> {
     console.log(`📧 sendVerificationEmail called for ${params.email} with userId: ${params.userId}`);

     // Generate a secure verification token using existing system
     const { token, hash } = generateVerificationToken();
     console.log(`🔐 Generated verification token: ${token}`);

     // Ensure HTTPS is used for verification URLs
     const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://gapi.org';
     const verificationUrl = `${baseUrl}/email-verification?token=${token}&pendingUserId=${params.userId}`;

     // Create HTML content for verification email
     const htmlContent = this.createVerificationEmailHTML(params.name, verificationUrl);
     
     // Create text version for email clients that don't support HTML
     const textContent = this.createVerificationEmailText(params.name, verificationUrl);

     try {
       const result = await this.sendEmail({
         to: params.email,
         subject: 'Please verify your e-mail address - GAPI',
         html: htmlContent,
         text: textContent,
       });

       console.log(`✅ Verification email sent to ${params.email}`);
       console.log(`   Token: ${token}`);
       console.log(`   Hash: ${hash}`);
       
       // Return both the result and the hash for database storage
       return {
         ...result,
         tokenHash: hash
       };
     } catch (error) {
       console.error('❌ Failed to send verification email:', error);
       throw error;
     }
   }

  /**
   * Create HTML content for verification email
   */
  private createVerificationEmailHTML(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - GAPI</title>
          <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .button { background-color: #1E40AF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; text-align: center; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
              .url { word-break: break-all; color: #666; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px; }
              .expiry { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 10px; border-radius: 4px; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="header">
              <h2 style="color: #333;">Welcome to GAPI!</h2>
          </div>
          
          <p>Hi ${name},</p>
          <p>Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button">
                  Verify Email Address
              </a>
          </div>
          
          <div class="expiry">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0;">
                  <li>This link will expire in <strong>24 hours</strong></li>
                  <li>If you didn't create this account, you can safely ignore this email</li>
                  <li>For security, this link can only be used once</li>
              </ul>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <div class="url">${verificationUrl}</div>
          
          <div class="footer">
              <p>This is an automated message from GAPI. Please do not reply to this email.</p>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Create text content for verification email
   */
  private createVerificationEmailText(name: string, verificationUrl: string): string {
    return `
Welcome to GAPI!

Hi ${name},

Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by visiting the link below:

${verificationUrl}

⚠️ IMPORTANT:
- This link will expire in 24 hours
- If you didn't create this account, you can safely ignore this email
- For security, this link can only be used once

This is an automated message from GAPI. Please do not reply to this email.
    `.trim();
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to GAPI!</title>
          <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h2 style="color: #333;">Welcome to GAPI!</h2>
          </div>
          
          <p>Hi ${name},</p>
          <p>Your email has been successfully verified! You can now complete your membership registration and payment.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          
          <div class="footer">
              <p>Thank you for choosing GAPI!</p>
          </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to GAPI!

Hi ${name},

Your email has been successfully verified! You can now complete your membership registration and payment.

If you have any questions or need assistance, please don't hesitate to contact us.

Thank you for choosing GAPI!
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Welcome to GAPI - Email Verified!',
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, userId: string): Promise<any> {
    // Generate a secure password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log(`🔐 Generated password reset token: ${resetToken}`);

    const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://gapi.org';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - GAPI</title>
          <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .button { background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; text-align: center; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
              .url { word-break: break-all; color: #666; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px; }
              .expiry { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 10px; border-radius: 4px; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="header">
              <h2 style="color: #333;">Password Reset Request</h2>
          </div>
          
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">
                  Reset Password
              </a>
          </div>
          
          <div class="expiry">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0;">
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request a password reset, you can safely ignore this email</li>
                  <li>For security, this link can only be used once</li>
              </ul>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <div class="url">${resetUrl}</div>
          
          <div class="footer">
              <p>This is an automated message from GAPI. Please do not reply to this email.</p>
          </div>
      </body>
      </html>
    `;

    const textContent = `
Password Reset Request - GAPI

Hi ${name},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

⚠️ IMPORTANT:
- This link will expire in 1 hour
- If you didn't request a password reset, you can safely ignore this email
- For security, this link can only be used once

This is an automated message from GAPI. Please do not reply to this email.
    `.trim();

    try {
      const result = await this.sendEmail({
        to: email,
        subject: 'Reset Your Password - GAPI',
        html: htmlContent,
        text: textContent,
      });

      console.log(`✅ Password reset email sent to ${email}`);
      console.log(`   Token expires: ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get configuration status
   */
  getConfigStatus() {
    return {
      apiKeyConfigured: !!this.apiKey,
      domainConfigured: !!this.domain,
      domain: this.domain || 'Not configured',
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      serviceReady: this.isConfigured
    };
  }
}

// Export singleton instance
export const mailgunEmailService = new MailgunEmailService();

// Export the class for testing purposes
export { MailgunEmailService };
