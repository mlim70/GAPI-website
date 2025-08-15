// Sender.net email service for GAPI
import axios from 'axios';
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

    console.log(`🔧 Sender.net configuration:`, {
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      apiKeyPrefix: config.apiKey?.substring(0, 10) + '...',
      domain: config.domain,
      baseUrl: this.baseUrl
    });

    try {
      // First, create a transactional campaign
      const campaignData = {
        name: `Transactional Email - ${options.subject}`,
        subject: options.subject,
        html_content: options.html,
        text_content: options.text,
        reply_to: options.from || `noreply@${config.domain}`,
        content_type: 'html'
      };

      console.log('📧 Creating transactional campaign...');
      const campaignResponse = await axios.post(`${this.baseUrl}/campaigns`, campaignData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const campaignId = campaignResponse.data.id;
      console.log(`✅ Campaign created with ID: ${campaignId}`);

      // Now send the transactional campaign to the specific recipient
      const sendData = {
        recipient_email: options.to,
        variables: {
          recipient_name: options.to.split('@')[0] // Basic name extraction
        }
      };

      console.log(`📧 Sending email to ${options.to} from ${campaignData.reply_to}`);
      console.log(`📧 Campaign data:`, {
        to: options.to,
        from: campaignData.reply_to,
        subject: campaignData.subject,
        hasHtml: !!campaignData.html_content,
        hasText: !!campaignData.text_content,
        htmlLength: campaignData.html_content?.length || 0,
        textLength: campaignData.text_content?.length || 0
      });

      console.log(`🌐 Making request to: ${this.baseUrl}/campaigns`);
      console.log(`🔑 Authorization: Bearer ${config.apiKey.substring(0, 10)}...`);
      
      console.log('📧 Sending transactional campaign...');
      const response = await axios.post(`${this.baseUrl}/message/${campaignId}/send`, sendData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`   Campaign ID: ${campaignId}`);
      console.log(`   Email ID: ${response.data.emailId}`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response data:`, response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Response Data:', error.response.data);
        console.error('   Response Headers:', error.response.headers);
      }
      if (error.request) {
        console.error('   Request made but no response received');
        console.error('   Request URL:', `${this.baseUrl}/campaigns`);
        console.error('   Request Method:', 'POST');
      }
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
      from: `GAPI <noreply@gapi.org>`,
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
      from: `GAPI <noreply@gapi.org>`,
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
      from: `GAPI <noreply@gapi.org>`,
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
      from: `GAPI <noreply@gapi.org>`,
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
      from: `GAPI <noreply@gapi.org>`,
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
   * Test the Sender.net configuration by making a simple API call
   */
  async testConfiguration(): Promise<boolean> {
    const config = this.getConfiguration();
    if (!config.isConfigured) {
      console.error('❌ Sender.net not configured');
      return false;
    }

    try {
      console.log(`🧪 Testing Sender.net configuration...`);
      console.log(`   API Key: ${config.apiKey ? 'Present' : 'Missing'} (${config.apiKey?.length || 0} chars)`);
      console.log(`   Domain: ${config.domain || 'Missing'}`);
      console.log(`   Base URL: ${this.baseUrl}`);
      
      // Try to make a simple API call to test the configuration
      const response = await axios.get(`${this.baseUrl}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Sender.net configuration test successful`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Available campaigns:`, response.data);
      
      // Test if we can create a campaign (required for transactional emails)
      if (response.data && response.data.data && response.data.data.length > 0) {
        console.log(`   ✅ Campaigns endpoint accessible - can create transactional emails`);
      } else {
        console.log(`   ⚠️ Campaigns endpoint accessible but may have limitations`);
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Sender.net configuration test failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Response Data:', error.response.data);
      }
      return false;
    }
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
