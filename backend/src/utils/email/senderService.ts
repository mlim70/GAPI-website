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
  SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID,
  SENDER_TX_CONTACT_FORM_ID
} from '../../config/env';
import { logger } from '../logger';

interface VerificationEmailParams {
  email: string;
  name: string;
  token: string;
}

interface AccountDeletionEmailParams {
  email: string;
  name: string;
  deletionDate: Date;
  preservedData: {
    subscriptionStatus: string;
  };
}

interface PasswordChangeEmailParams {
  email: string;
  name: string;
  changeTimestamp: Date;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
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
    
    // Debug template configurations on service initialization
    logger.debug('SenderEmailService initialized');
    this.debugTemplateConfigurations();
  }

  // Lazy loading method to get configuration
  private getConfiguration() {
    if (!this.isConfigured) {
      this.apiKey = SENDER_API_KEY;
      this.domain = SENDER_DOMAIN;
      
      if (this.apiKey && this.domain) {
        this.isConfigured = true;
      } else {
        logger.warn('Sender.net not configured - email functionality will be disabled');
        logger.warn('Please set SENDER_API_KEY and SENDER_DOMAIN in your .env file');
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
    logger.debug('sendTransactionalById called with:', {
      templateId: id,
      recipientEmail: to,
      variablesCount: variables ? Object.keys(variables).length : 0,
      variablesKeys: variables ? Object.keys(variables) : [],
      variablesPreview: variables ? Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key, 
          typeof value === 'string' && value.length > 100 
            ? `${value.substring(0, 50)}...${value.substring(value.length - 20)}` 
            : value
        ])
      ) : undefined
    });

    const { apiKey, isConfigured } = this.getConfiguration();
    logger.debug('Configuration status:', {
      isConfigured,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined'
    });
    
    if (!isConfigured) {
      logger.error('Sender.net not configured in sendTransactionalById');
      throw new Error('Sender.net not configured');
    }
    
    const url = `https://api.sender.net/v2/message/${encodeURIComponent(id)}/send`;
    logger.debug('API endpoint constructed:', {
      url,
      urlLength: url.length,
      templateIdEncoded: encodeURIComponent(id),
      originalTemplateId: id,
      fullEndpoint: `https://api.sender.net/v2/message/${id}/send`,
      encodedEndpoint: `https://api.sender.net/v2/message/${encodeURIComponent(id)}/send`
    });
    
    // Mask sensitive information in logs
    const safeVars = variables ? { ...variables, verificationUrl: '[redacted]' } : undefined;
    
    logger.debug('Sending transactional email via template ID:', {
      templateId: id,
      to,
      variables: safeVars,
      url
    });
    
    const payload: any = { 
      recipient_email: to, 
      variables 
    };
    
    logger.debug('Request payload prepared:', {
      payloadKeys: Object.keys(payload),
      recipientEmail: payload.recipient_email,
      variablesCount: payload.variables ? Object.keys(payload.variables).length : 0,
      variablesKeys: payload.variables ? Object.keys(payload.variables) : [],
      payloadSize: JSON.stringify(payload).length
    });
    
    try {
      logger.debug('Making HTTP request to Sender.net API...');
      const res = await axios.post(url, payload, {
        headers: { 
          Authorization: `Bearer ${apiKey}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 10000
      });
      
      logger.debug('Transactional email sent successfully:', {
        templateId: id,
        to,
        responseStatus: res.status
      });
      
      logger.debug('Sender.net API response details:', {
        status: res.status,
        statusText: res.statusText,
        responseData: res.data,
        responseHeaders: res.headers,
        responseSize: JSON.stringify(res.data).length
      });
      
      return res.data;
    } catch (error: any) {
      logger.error('Sender.net API error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        payload: payload
      });
      
      logger.error('Detailed error analysis:', {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        isAxiosError: error?.isAxiosError,
        hasResponse: !!error?.response,
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
        responseHeaders: error?.response?.headers,
        requestConfig: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers,
          timeout: error?.config?.timeout
        },
        requestData: error?.config?.data,
        originalPayload: payload
      });
      
      throw error;
    }
  }

  /**
   * Debug method to compare template configurations
   */
  debugTemplateConfigurations() {
    logger.debug('Template configuration comparison:');
    logger.debug('  📧 Verification Email Template:', {
      id: SENDER_TX_VERIFICATION_ID,
      configured: !!SENDER_TX_VERIFICATION_ID,
      type: typeof SENDER_TX_VERIFICATION_ID
    });
    logger.debug('  📧 Welcome Email Template:', {
      id: SENDER_TX_WELCOME_ID,
      configured: !!SENDER_TX_WELCOME_ID,
      type: typeof SENDER_TX_WELCOME_ID
    });
    logger.debug('  📧 Password Reset Template:', {
      id: SENDER_TX_PASSWORD_RESET_ID,
      configured: !!SENDER_TX_PASSWORD_RESET_ID,
      type: typeof SENDER_TX_PASSWORD_RESET_ID
    });
    logger.debug('  📧 Account Deletion Template:', {
      id: SENDER_TX_ACCOUNT_DELETION_ID,
      configured: !!SENDER_TX_ACCOUNT_DELETION_ID,
      type: typeof SENDER_TX_ACCOUNT_DELETION_ID
    });
    logger.debug('  📧 Password Change Template:', {
      id: SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID,
      configured: !!SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID,
      type: typeof SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID
    });
    logger.debug('  📧 Contact Form Template:', {
      id: SENDER_TX_CONTACT_FORM_ID,
      configured: !!SENDER_TX_CONTACT_FORM_ID,
      type: typeof SENDER_TX_CONTACT_FORM_ID
    });
  }

  /**
   * Send verification email using transactional template
   */
  async sendVerificationEmail(params: VerificationEmailParams): Promise<any> {
    const { email, name, token } = params;
    
    const base = getFrontendUrl();
    const verificationUrl = `${base}/email-verification?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // Check if we have the transactional template ID
    const templateId = SENDER_TX_VERIFICATION_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_VERIFICATION_ID not configured - verification emails cannot be sent');
    }

    logger.debug('Using transactional template for verification email:', templateId);
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

    logger.debug('Using transactional template for welcome email:', templateId);
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
    logger.debug('sendPasswordResetEmail called with:', {
      email,
      name,
      userId,
      tokenLength: token?.length || 0,
      tokenPreview: token ? `${token.substring(0, 8)}...` : 'undefined'
    });

    const base = getFrontendUrl();
    logger.debug('Frontend base URL:', base);
    
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;
    logger.debug('Constructed reset URL:', {
      fullUrl: resetUrl,
      urlLength: resetUrl.length,
      tokenEncoded: encodeURIComponent(token),
      userIdEncoded: encodeURIComponent(userId)
    });

    // Check if we have a transactional template ID for password reset
    const templateId = SENDER_TX_PASSWORD_RESET_ID;
    logger.debug('Template ID configuration:', {
      templateId,
      isConfigured: !!templateId,
      templateIdType: typeof templateId,
      templateIdLength: templateId?.length || 0
    });
    
    if (!templateId) {
      logger.error('SENDER_TX_PASSWORD_RESET_ID not configured');
      throw new Error('SENDER_TX_PASSWORD_RESET_ID not configured - password reset emails cannot be sent');
    }

    // Prepare variables for template
    const templateVariables = {
      name,
      resetUrl,
      Year: new Date().getFullYear().toString()
    };
    
    logger.debug('Template variables prepared:', {
      variables: templateVariables,
      variablesCount: Object.keys(templateVariables).length,
      nameType: typeof templateVariables.name,
      resetUrlType: typeof templateVariables.resetUrl,
      yearType: typeof templateVariables.Year,
      resetUrlLength: templateVariables.resetUrl.length
    });

    logger.debug('Using transactional template for password reset email:', templateId);
    
    try {
      const result = await this.sendTransactionalById(
        templateId,
        email,
        templateVariables
      );
      logger.debug('Password reset email sent successfully via sendTransactionalById');
      return result;
    } catch (error) {
      logger.error('sendTransactionalById failed for password reset:', {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
        templateId,
        email
      });
      throw error;
    }
  }

  /**
   * Send account deletion confirmation email using transactional template
   */
  async sendAccountDeletionEmail(params: AccountDeletionEmailParams): Promise<any> {
    const { email, name, deletionDate, preservedData } = params;

    // Check if we have a transactional template ID for account deletion
    const templateId = SENDER_TX_ACCOUNT_DELETION_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_ACCOUNT_DELETION_ID not configured - account deletion emails cannot be sent');
    }

    logger.debug('Using transactional template for account deletion email:', templateId);
    
    // Format the date and time strings for the template
    const deletionDateString = deletionDate.toLocaleDateString();
    const deletionTimeString = deletionDate.toLocaleTimeString();
    
    return this.sendTransactionalById(
      templateId,
      email,
      {
        name,
        deletionDateString,
        deletionTimeString,
        Year: new Date().getFullYear().toString()
      }
    );
  }

  /**
   * Send password change notification email using transactional template
   */
  async sendPasswordChangeEmail(params: PasswordChangeEmailParams): Promise<any> {
    const { email, name, changeTimestamp, ipAddress, location, userAgent } = params;

    // Check if we have a transactional template ID for password change confirmation
    const templateId = SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID;
    if (!templateId) {
      throw new Error('SENDER_TX_PASSWORD_CHANGE_CONFIRM_ID not configured - password change confirmation emails cannot be sent');
    }

    logger.debug('Using transactional template for password change confirmation email:', templateId);
    
    // Format the timestamp for the template
    const timestamp = changeTimestamp.toLocaleString();
    
    return this.sendTransactionalById(
      templateId,
      email,
      {
        user: {
          firstName: name.split(' ')[0] || name,
          lastName: name.split(' ').slice(1).join(' ') || ''
        },
        timestamp,
        ipAddress: ipAddress || 'Unknown',
        location: location || 'Unknown',
        userAgent: userAgent || 'Unknown',
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

    logger.debug('Using transactional template for contact form email:', templateId);
    return this.sendTransactionalById(
      templateId,
      CONTACT_EMAIL,
      {
        name: formData.name,
        senderEmail: formData.email, // Renamed to avoid conflict with Sender.net's email variable
        subject: formData.subject,
        message: formData.message,
        date: formData.date
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
      logger.error('Sender.net not configured');
      return false;
    }

    try {
      logger.debug(`Testing Sender.net configuration...`);
      logger.debug(`   API Key: ${config.apiKey ? 'Present' : 'Missing'} (${config.apiKey?.length || 0} chars)`);
      logger.debug(`   Domain: ${config.domain || 'Missing'}`);
      logger.debug(`   Base URL: ${this.baseUrl}`);
      
      // Try to make a simple API call to test the configuration
      const response = await axios.get(`${this.baseUrl}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      logger.debug(`Sender.net configuration test successful`);
      logger.debug(`   Response status: ${response.status}`);
      logger.debug(`   Available campaigns:`, response.data);
      
      // Test if we can create a campaign (required for transactional emails)
      if (response.data && response.data.data && response.data.data.length > 0) {
        logger.debug(`   ✅ Campaigns endpoint accessible - can create transactional emails`);
      } else {
        logger.debug(`   ⚠️ Campaigns endpoint accessible but may have limitations`);
      }
      
      return true;
    } catch (error: any) {
      logger.error('Sender.net configuration test failed:', error.message);
      if (error.response) {
        logger.error('   Status:', error.response.status);
        logger.error('   Status Text:', error.response.statusText);
        logger.error('   Response Data:', error.response.data);
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