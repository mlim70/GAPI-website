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
import { 
  SENDER_API_KEY, 
  SENDER_DOMAIN, 
  CONTACT_EMAIL, 
  SENDER_TX_VERIFICATION_ID, 
  SENDER_TX_WELCOME_ID,
  SENDER_TX_PASSWORD_RESET_ID,
  SENDER_TX_ACCOUNT_DELETION_ID,
  SENDER_TX_CONTACT_FORM_ID
} from '../../config/env';

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
   * Send transactional email using a template ID
   */
  private async sendTransactionalById(id: string, to: string, variables?: Record<string, any>) {
    const { apiKey, isConfigured } = this.getConfiguration();
    if (!isConfigured) throw new Error('Sender.net not configured');
    
    const url = `https://api.sender.net/v2/message/${encodeURIComponent(id)}/send`;
    
    // Mask sensitive information in logs
    const safeVars = variables ? { ...variables, verificationUrl: '[redacted]' } : undefined;
    
    console.log('📧 Sending transactional email via template ID:', {
      templateId: id,
      to,
      variables: safeVars,
      url
    });
    
    const res = await axios.post(url, { 
      recipient_email: to, 
      variables 
    }, {
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      timeout: 10000
    });
    
    console.log('✅ Transactional email sent successfully:', {
      templateId: id,
      to,
      responseStatus: res.status
    });
    
    return res.data;
  }

  /**
   * Send a basic email (fallback method)
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
      // Use a verified sender address - either the provided from address or the configured domain
      const fromAddress = options.from || `GAPI <noreply@${config.domain}>`;
      
      // For transactional emails, use the correct Sender.net API format
      const messageData = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html_content: options.html,
        text_content: options.text,
        reply_to: fromAddress
      };

      console.log('📧 Sending transactional email...');
      console.log('📧 From address:', fromAddress);
      console.log('📧 To address:', options.to);
      
      const response = await axios.post(`${this.baseUrl}/messages`, messageData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response data:`, response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      
      // Check if it's a domain verification error
      if (error.response?.status === 422 && error.response?.data?.errors?.['domain.invalid']) {
        console.error('🔴 Domain verification error detected');
        console.error('   The domain is not verified with Sender.net');
        console.error('   Please verify your domain or use a verified email address');
      }
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Response Data:', error.response.data);
        console.error('   Response Headers:', error.response.headers);
      }
      if (error.request) {
        console.error('   Request made but no response received');
        console.error('   Request URL:', `${this.baseUrl}/messages`);
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
   * Send verification email using transactional template
   */
  async sendVerificationEmail(params: VerificationEmailParams): Promise<any> {
    const { email, name, userId, token } = params;
    
    const base = getFrontendUrl();
    const verificationUrl = `${base}/email-verification?token=${encodeURIComponent(token)}&pendingUserId=${encodeURIComponent(userId)}`;

    // Check if we have the transactional template ID
    const templateId = SENDER_TX_VERIFICATION_ID;
    if (templateId) {
      console.log('📧 Using transactional template for verification email:', templateId);
      return this.sendTransactionalById(
        templateId,
        email,
        {
          name,
          verificationUrl,                     // matches {{ verificationUrl }}
          Year: new Date().getFullYear().toString() // matches {{ Year }} (capital Y)
        }
      );
    } else {
      console.log('⚠️ No transactional template ID found, falling back to custom email');
      // Fallback to the old method if no template ID
      const html = createVerificationEmailHTML(name, verificationUrl);
      const text = createVerificationEmailText(name, verificationUrl);
      
      return this.sendEmail({
        to: email,
        subject: 'Verify Your GAPI Account',
        html,
        text
      });
    }
  }

  /**
   * Send welcome email using transactional template
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    // Check if we have a transactional template ID for welcome emails
    const templateId = SENDER_TX_WELCOME_ID;
    if (templateId) {
      console.log('📧 Using transactional template for welcome email:', templateId);
      return this.sendTransactionalById(
        templateId,
        email,
        {
          name,
          Year: new Date().getFullYear().toString()
        }
      );
    } else {
      console.log('⚠️ No transactional template ID found for welcome email, falling back to custom email');
      // Fallback to the old method if no template ID
      const html = createWelcomeEmailHTML(name);
      const text = createWelcomeEmailText(name);
      
      return this.sendEmail({
        to: email,
        subject: 'Welcome to GAPI!',
        html,
        text
      });
    }
  }

  /**
   * Send password reset email using transactional template
   */
  async sendPasswordResetEmail(email: string, name: string, userId: string, token: string): Promise<any> {
    const base = getFrontendUrl();
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;

    // Check if we have a transactional template ID for password reset
    const templateId = SENDER_TX_PASSWORD_RESET_ID;
    if (templateId) {
      console.log('📧 Using transactional template for password reset email:', templateId);
      return this.sendTransactionalById(
        templateId,
        email,
        {
          name,
          resetUrl,
          Year: new Date().getFullYear().toString()
        }
      );
    } else {
      console.log('⚠️ No transactional template ID found for password reset, falling back to custom email');
      // Fallback to the old method if no template ID
      const html = createPasswordResetEmailHTML(name, resetUrl);
      const text = createPasswordResetEmailText(name, resetUrl);
      
      return this.sendEmail({
        to: email,
        subject: 'Reset Your GAPI Password',
        html,
        text
      });
    }
  }

  /**
   * Send account deletion confirmation email using transactional template
   */
  async sendAccountDeletionEmail(params: AccountDeletionEmailParams): Promise<any> {
    const { email, name, originalEmail, deletionDate, preservedData } = params;

    // Check if we have a transactional template ID for account deletion
    const templateId = SENDER_TX_ACCOUNT_DELETION_ID;
    if (templateId) {
      console.log('📧 Using transactional template for account deletion email:', templateId);
      return this.sendTransactionalById(
        templateId,
        email,
        {
          name,
          originalEmail,
          deletionDate: deletionDate.toISOString(),
          orderCount: preservedData.orderCount,
          totalSpent: preservedData.totalSpent,
          subscriptionStatus: preservedData.subscriptionStatus,
          Year: new Date().getFullYear().toString()
        }
      );
    } else {
      console.log('⚠️ No transactional template ID found for account deletion, falling back to custom email');
      // Fallback to the old method if no template ID
      const html = createAccountDeletionEmailHTML(name, deletionDate, preservedData, originalEmail);
      const text = createAccountDeletionEmailText(name, deletionDate, preservedData, originalEmail);
      
      return this.sendEmail({
        to: email,
        subject: 'GAPI Account Deletion Confirmation',
        html,
        text
      });
    }
  }

  /**
   * Send contact form email using transactional template
   */
  async sendContactFormEmail(formData: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<any> {
    // Check if we have a transactional template ID for contact form
    const templateId = SENDER_TX_CONTACT_FORM_ID;
    if (templateId) {
      console.log('📧 Using transactional template for contact form email:', templateId);
      return this.sendTransactionalById(
        templateId,
        CONTACT_EMAIL,
        {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          Year: new Date().getFullYear().toString()
        }
      );
    } else {
      console.log('⚠️ No transactional template ID found for contact form, falling back to custom email');
      // Fallback to the old method if no template ID
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
        text
      });
    }
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