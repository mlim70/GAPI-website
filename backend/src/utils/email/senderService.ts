// Sender.net email service for GAPI
import axios from 'axios';
import User from '../../models/user.model';
import { getFrontendUrl } from '../../config/urls';
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
import { SENDER_API_KEY, SENDER_DOMAIN, CONTACT_EMAIL } from '../../config/env';

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

interface AccountDeletionEmailParams {
  email: string;
  name: string;
  originalEmail: string;
  deletionDate: Date;
  preservedData: {
    orderCount: number;
    totalSpent: number;
    subscriptionStatus: string;
  };
}

class SenderEmailService {
  private apiKey: string;
  private domain: string;
  private isConfigured: boolean = false;
  private baseUrl: string = 'https://api.sender.net/v2';

  constructor() {
    // Don't access environment variables in constructor - use lazy loading
    this.apiKey = '';
    this.domain = '';
    this.isConfigured = false;
  }

  // Lazy loading method to get configuration
  private getConfiguration() {
    if (!this.isConfigured) {
      this.apiKey = SENDER_API_KEY;
      this.domain = SENDER_DOMAIN;
      
      if (this.apiKey && this.domain) {
        this.isConfigured = true;
      } else {
        console.warn('⚠️ Sender.net not configured - email functionality will be disabled');
        console.warn('   Please set SENDER_API_KEY and SENDER_DOMAIN in your .env file');
      }
    }

    return {
      apiKey: this.apiKey,
      domain: this.domain,
      isConfigured: this.isConfigured
    };
  }

  /**
   * Send a basic email
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    const config = this.getConfiguration();
    if (!config.isConfigured) {
      throw new Error('Sender.net not configured - please set SENDER_API_KEY and SENDER_DOMAIN');
    }

    try {
      const emailData = {
        from: options.from || `GAPI <noreply@${config.domain}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: options.headers || {}
      };

      const response = await axios.post(`${this.baseUrl}/emails`, emailData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`   Message ID: ${response.data.id}`);
      
      return response.data;
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
   * Send verification email
   */
  async sendVerificationEmail(params: VerificationEmailParams): Promise<any> {
    const { email, name, userId, token } = params;
    
    const base = getFrontendUrl();
    const verificationUrl = `${base}/email-verification?token=${token}&pendingUserId=${userId}`;
    
    const html = createVerificationEmailHTML(name, verificationUrl);
    const text = createVerificationEmailText(name, verificationUrl);
    
    return this.sendEmail({
      to: email,
      subject: 'Verify Your GAPI Account',
      html,
      text,
      headers: {
        'X-Email-Type': 'verification',
        'X-User-ID': userId
      }
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    const html = createWelcomeEmailHTML(name);
    const text = createWelcomeEmailText(name);
    
    return this.sendEmail({
      to: email,
      subject: 'Welcome to GAPI!',
      html,
      text,
      headers: {
        'X-Email-Type': 'welcome'
      }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, userId: string, token: string): Promise<any> {
    const base = getFrontendUrl();
    const resetUrl = `${base}/reset-password?token=${token}&userId=${userId}`;
    
    const html = createPasswordResetEmailHTML(name, resetUrl);
    const text = createPasswordResetEmailText(name, resetUrl);
    
    return this.sendEmail({
      to: email,
      subject: 'Reset Your GAPI Password',
      html,
      text,
      headers: {
        'X-Email-Type': 'password-reset',
        'X-User-ID': userId,
        'X-Reset-Token': token
      }
    });
  }

  /**
   * Send account deletion confirmation email
   */
  async sendAccountDeletionEmail(params: AccountDeletionEmailParams): Promise<any> {
    const { email, name, originalEmail, deletionDate, preservedData } = params;
    
    const html = createAccountDeletionEmailHTML(name, deletionDate, preservedData, originalEmail);
    const text = createAccountDeletionEmailText(name, deletionDate, preservedData, originalEmail);
    
    return this.sendEmail({
      to: email,
      subject: 'GAPI Account Deletion Confirmation',
      html,
      text,
      headers: {
        'X-Email-Type': 'account-deletion'
      }
    });
  }

  /**
   * Send contact form email
   */
  async sendContactFormEmail(formData: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<any> {
    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${formData.name}</p>
      <p><strong>Email:</strong> ${formData.email}</p>
      <p><strong>Subject:</strong> ${formData.subject}</p>
      <p><strong>Message:</strong></p>
      <p>${formData.message}</p>
    `;
    
    const text = `
      New Contact Form Submission
      
      Name: ${formData.name}
      Email: ${formData.email}
      Subject: ${formData.subject}
      Message: ${formData.message}
    `;
    
    return this.sendEmail({
              to: CONTACT_EMAIL,
      subject: `Contact Form: ${formData.subject}`,
      html,
      text,
      headers: {
        'X-Email-Type': 'contact-form',
        'Reply-To': formData.email
      }
    });
  }

  /**
   * Check if the service is configured
   */
  isServiceConfigured(): boolean {
    return this.getConfiguration().isConfigured;
  }

  /**
   * Get configuration status
   */
  getConfigStatus() {
    const config = this.getConfiguration();
    return {
      serviceName: 'Sender.net',
      apiKeyConfigured: !!config.apiKey,
      domainConfigured: !!config.domain,
      serviceReady: config.isConfigured
    };
  }
}

// Export singleton instance
export const senderEmailService = new SenderEmailService();

// Export the class for testing purposes
export { SenderEmailService };
