// Sender.net email service for GAPI
import axios from 'axios';
import { getFrontendUrl } from '../../config/urls';
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
   * Send newsletter using Sender.net's campaign/bulk email functionality
   */
  async sendNewsletter(subject: string, html: string, mailingListAddress: string): Promise<any> {
    const config = this.getConfiguration();
    if (!config.isConfigured) {
      throw new Error('Sender.net not configured - please set SENDER_API_KEY and SENDER_DOMAIN');
    }

    try {
      console.log('📧 Creating newsletter campaign...');
      
      // Create a campaign for the newsletter
      const campaignData = {
        name: `Newsletter - ${subject}`,
        subject: subject,
        html_content: html,
        from: `GAPI Newsletter <noreply@${config.domain}>`,
        reply_to: 'info@gapi.org',
        content_type: 'html'
      };

      const campaignResponse = await axios.post(`${this.baseUrl}/campaigns`, campaignData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const campaignId = campaignResponse.data.id;
      console.log(`✅ Newsletter campaign created with ID: ${campaignId}`);

      // Send the campaign to the mailing list
      const sendData = {
        recipient_email: mailingListAddress,
        variables: {
          subject: subject
        }
      };

      console.log(`📧 Sending newsletter to mailing list: ${mailingListAddress}`);
      
      const response = await axios.post(`${this.baseUrl}/message/${campaignId}/send`, sendData, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ Newsletter sent successfully to mailing list`);
      console.log(`   Campaign ID: ${campaignId}`);
      console.log(`   Response status: ${response.status}`);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send newsletter:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Response Data:', error.response.data);
      }
      if (error.request) {
        console.error('   Request made but no response received');
        console.error('   Request URL:', `${this.baseUrl}/campaigns`);
        console.error('   Request Method:', 'POST');
      }
      throw new Error(`Failed to send newsletter: ${error.message}`);
    }
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
    if (!templateId) {
      throw new Error('SENDER_TX_VERIFICATION_ID not configured - verification emails cannot be sent');
    }

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
  }

  /**
   * Send welcome email using transactional template
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    // Check if we have a transactional template ID for welcome emails
    const templateId = SENDER_TX_WELCOME_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_WELCOME_ID not configured - welcome emails cannot be sent');
    }

    console.log('📧 Using transactional template for welcome email:', templateId);
    return this.sendTransactionalById(
      templateId,
      email,
      {
        name,
        Year: new Date().getFullYear().toString()
      }
    );
  }

  /**
   * Send password reset email using transactional template
   */
  async sendPasswordResetEmail(email: string, name: string, userId: string, token: string): Promise<any> {
    const base = getFrontendUrl();
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;

    // Check if we have a transactional template ID for password reset
    const templateId = SENDER_TX_PASSWORD_RESET_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_PASSWORD_RESET_ID not configured - password reset emails cannot be sent');
    }

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
  }

  /**
   * Send account deletion confirmation email using transactional template
   */
  async sendAccountDeletionEmail(params: AccountDeletionEmailParams): Promise<any> {
    const { email, name, originalEmail, deletionDate, preservedData } = params;

    // Check if we have a transactional template ID for account deletion
    const templateId = SENDER_TX_ACCOUNT_DELETION_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_ACCOUNT_DELETION_ID not configured - account deletion emails cannot be sent');
    }

    console.log('📧 Using transactional template for account deletion email:', templateId);
    
    // Format the date and time strings for the template
    const deletionDateString = deletionDate.toLocaleDateString();
    const deletionTimeString = deletionDate.toLocaleTimeString();
    
    return this.sendTransactionalById(
      templateId,
      email,
      {
        name,
        originalEmail,
        deletionDateString,
        deletionTimeString,
        Year: new Date().getFullYear().toString()
      }
    );
  }

  /**
   * Send contact form email using transactional template
   */
  async sendContactFormEmail(formData: {
    name: string;
    email: string;
    subject: string;
    message: string;
    date: string;
  }): Promise<any> {
    // Check if we have a transactional template ID for contact form
    const templateId = SENDER_TX_CONTACT_FORM_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_CONTACT_FORM_ID not configured - contact form emails cannot be sent');
    }

    console.log('📧 Using transactional template for contact form email:', templateId);
    return this.sendTransactionalById(
      templateId,
      CONTACT_EMAIL,
      {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        date: formData.date,
        Year: new Date().getFullYear().toString()
      }
    );
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