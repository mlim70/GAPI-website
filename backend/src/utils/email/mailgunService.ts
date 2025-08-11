// Mailgun email service for GAPI
import 'dotenv/config';
import crypto from 'crypto';
import User from '../../models/user.model.js';
import { 
  createAccountDeletionEmailHTML, 
  createAccountDeletionEmailText,
  createVerificationEmailHTML,
  createVerificationEmailText,
  createWelcomeEmailHTML,
  createWelcomeEmailText,
  createPasswordResetEmailHTML,
  createPasswordResetEmailText
} from './templates';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  headers?: Record<string, string>;
}

interface VerificationEmailParams {
  email: string;
  name: string;
  userId: string;
  token: string;
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
        from: options.from || `GAPI <noreply@${this.domain}>`,
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

      // Add custom headers if provided
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          emailData[key] = value;
        });
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
   * Send a custom email (alias for sendEmail)
   */
  async sendCustomEmail(options: EmailOptions): Promise<any> {
    return this.sendEmail(options);
  }

  /**
   * Send account deletion confirmation email
   */
  async sendAccountDeletionEmail({
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
  }): Promise<any> {
    const subject = 'Your GAPI Account Has Been Deleted';
    
    const html = createAccountDeletionEmailHTML(
      name,
      deletionDate,
      preservedData,
      originalEmail
    );
    
    const text = createAccountDeletionEmailText(
      name,
      deletionDate,
      preservedData,
      originalEmail
    );

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

    /**
   * Send email verification email
   */
   async sendVerificationEmail(params: VerificationEmailParams): Promise<any> {
     console.log(`📧 sendVerificationEmail called for ${params.email} with userId: ${params.userId}`);

     // Token is required for verification emails
     if (!params.token) {
       throw new Error('Token is required for verification emails - this should never happen in production');
     }
     
     // Use the provided token and generate its hash
     const token = params.token;
     const hash = crypto.createHash('sha256').update(token).digest('hex');
     console.log(`🔐 Using provided token: ${token}`);

     // Ensure HTTPS is used for verification URLs
     const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://www.gapi.org';
     const verificationUrl = `${baseUrl}/auth/email-verification?token=${token}&pendingUserId=${params.userId}`;

     // Create HTML content for verification email
     const htmlContent = createVerificationEmailHTML(params.name, verificationUrl);
     
     // Create text version for email clients that don't support HTML
     const textContent = createVerificationEmailText(params.name, verificationUrl);

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
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    const htmlContent = createWelcomeEmailHTML(name);
    const textContent = createWelcomeEmailText(name);

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
    
    // Set token expiration (1 hour from now)
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    
    // Store the token hash and expiration in the database
    await User.findByIdAndUpdate(userId, {
      resetToken: resetToken,
      resetTokenExpires: resetTokenExpires
    });

    const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://gapi.org';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&userId=${userId}`;

    const htmlContent = createPasswordResetEmailHTML(name, resetUrl);
    const textContent = createPasswordResetEmailText(name, resetUrl);

    try {
      const result = await this.sendEmail({
        to: email,
        subject: 'Reset Your Password - GAPI',
        html: htmlContent,
        text: textContent,
      });

      console.log(`✅ Password reset email sent to ${email}`);
      console.log(`   Token expires: ${resetTokenExpires.toISOString()}`);
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
