// Sender.net newsletter service for GAPI
import axios from 'axios';
import { SENDER_API_KEY, SENDER_LIST_ID } from '../config/env';
import { normalizeEmail } from '../utils/email/emailUtils';

/**
 * Subscribe an email to the GAPI newsletter mailing list
 */
export async function senderSubscribe(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Sender.net: Subscribing email:', email);
    console.log('📧 Sender.net: Custom fields:', vars);
    
    const apiKey = SENDER_API_KEY;
    const listId = SENDER_LIST_ID;
    
    if (!apiKey || !listId) {
      throw new Error('Sender.net API key or list ID not configured');
    }
    
    // Sender.net v2 API for adding subscribers
    const response = await axios.post(`https://api.sender.net/v2/subscribers`, {
      email: normalizeEmail(email),
      list_id: listId,
      status: 'subscribed',
      custom_fields: {
        source: vars.source || 'webform',
        consentVersion: vars.consentVersion || '2025-01-01',
        subscribedAt: new Date().toISOString(),
        ...vars
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Sender.net: Successfully subscribed:', {
      email,
      listId,
      responseStatus: response.status,
      subscriberId: response.data?.id
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to subscribe:', {
      email,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle specific Sender.net errors
    if (error.response?.status === 409) {
      throw new Error('Email is already subscribed to the newsletter');
    } else if (error.response?.status === 400) {
      throw new Error('Invalid email address or subscription data');
    } else if (error.response?.status === 401) {
      throw new Error('Sender.net authentication failed - check API key');
    } else if (error.response?.status === 404) {
      throw new Error('Mailing list not found - check SENDER_LIST_ID');
    }
    
    throw new Error(`Failed to subscribe to newsletter: ${error.message}`);
  }
}

/**
 * Unsubscribe an email from the GAPI newsletter mailing list
 */
export async function senderUnsubscribe(email: string) {
  try {
    console.log('📧 Sender.net: Unsubscribing email:', email);
    
    const apiKey = SENDER_API_KEY;
    const listId = SENDER_LIST_ID;
    
    if (!apiKey || !listId) {
      throw new Error('Sender.net API key or list ID not configured');
    }
    
    // Sender.net v2 API for unsubscribing
    const response = await axios.put(`https://api.sender.net/v2/subscribers/${normalizeEmail(email)}`, {
      status: 'unsubscribed',
      custom_fields: {
        unsubscribedAt: new Date().toISOString()
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Sender.net: Successfully unsubscribed:', {
      email,
      listId,
      responseStatus: response.status
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to unsubscribe:', {
      email,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle specific Sender.net errors
    if (error.response?.status === 404) {
      throw new Error('Email not found in newsletter subscription list');
    } else if (error.response?.status === 401) {
      throw new Error('Sender.net authentication failed - check API key');
    }
    
    throw new Error(`Failed to unsubscribe from newsletter: ${error.message}`);
  }
}

/**
 * Get subscriber information from the GAPI newsletter mailing list
 */
export async function senderGetSubscriber(email: string) {
  try {
    console.log('📧 Sender.net: Getting subscriber info:', email);
    
    const apiKey = SENDER_API_KEY;
    
    if (!apiKey) {
      throw new Error('Sender.net API key not configured');
    }
    
    // Sender.net v2 API for getting subscriber
    const response = await axios.get(`https://api.sender.net/v2/subscribers/${normalizeEmail(email)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Sender.net: Successfully retrieved subscriber:', {
      email,
      responseStatus: response.status,
      subscriberData: response.data
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to get subscriber:', {
      email,
      error: error.message,
      status: error.response?.status
    });
    
    // Handle specific Sender.net errors
    if (error.response?.status === 404) {
      throw new Error('Subscriber not found');
    } else if (error.response?.status === 401) {
      throw new Error('Sender.net authentication failed - check API key');
    }
    
    throw new Error(`Failed to get subscriber information: ${error.message}`);
  }
}

/**
 * Update subscriber information in the GAPI newsletter mailing list
 */
export async function senderUpdateSubscriber(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Sender.net: Updating subscriber:', email);
    console.log('📧 Sender.net: Update fields:', vars);
    
    const apiKey = SENDER_API_KEY;
    
    if (!apiKey) {
      throw new Error('Sender.net API key not configured');
    }
    
    const response = await axios.put(`https://api.sender.net/v2/subscribers/${normalizeEmail(email)}`, {
      custom_fields: {
        updatedAt: new Date().toISOString(),
        ...vars
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Sender.net: Successfully updated subscriber:', {
      email,
      responseStatus: response.status,
      updatedFields: vars
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to update subscriber:', {
      email,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle specific Sender.net errors
    if (error.response?.status === 404) {
      throw new Error('Subscriber not found');
    } else if (error.response?.status === 401) {
      throw new Error('Sender.net authentication failed - check API key');
    } else if (error.response?.status === 400) {
      throw new Error('Invalid update data provided');
    }
    
    throw new Error(`Failed to update subscriber: ${error.message}`);
  }
}

/**
 * Check if a subscriber exists and get their status
 */
export async function senderCheckSubscriptionStatus(email: string): Promise<{
  exists: boolean;
  status: 'subscribed' | 'unsubscribed' | 'pending' | 'unknown';
  customFields?: Record<string, any>;
}> {
  try {
    const subscriber = await senderGetSubscriber(email);
    return {
      exists: true,
      status: subscriber.status || 'unknown',
      customFields: subscriber.custom_fields || {}
    };
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('Subscriber not found')) {
      return {
        exists: false,
        status: 'unknown'
      };
    }
    throw error;
  }
}

/**
 * Get all newsletter campaigns from Sender.net
 */
export async function senderGetCampaigns() {
  try {
    console.log('📧 Sender.net: Fetching campaigns');
    
    const apiKey = SENDER_API_KEY;
    
    if (!apiKey) {
      throw new Error('Sender.net API key not configured');
    }
    
    // Sender.net v2 API for getting campaigns
    const response = await axios.get(`https://api.sender.net/v2/campaigns`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Sender.net: Successfully retrieved campaigns:', {
      responseStatus: response.status,
      campaignCount: response.data?.data?.length || 0
    });
    
    // Transform the response to match our frontend types
    const campaigns = (response.data?.data || []).map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name || 'Untitled Campaign',
      subject: campaign.subject || 'No Subject',
      content: campaign.content || '',
      status: campaign.status || 'unknown',
      sentAt: campaign.sent_at,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      recipientCount: campaign.recipient_count,
      openRate: campaign.open_rate,
      clickRate: campaign.click_rate
    }));
    
    return campaigns;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to get campaigns:', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle specific Sender.net errors
    if (error.response?.status === 401) {
      throw new Error('Sender.net authentication failed - check API key');
    } else if (error.response?.status === 403) {
      throw new Error('Sender.net access denied - insufficient permissions');
    }
    
    throw new Error(`Failed to get newsletter campaigns: ${error.message}`);
  }
}
