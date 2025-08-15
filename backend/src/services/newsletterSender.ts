// Sender.net newsletter service for GAPI
import axios from 'axios';
import { SENDER_API_KEY, SENDER_LIST_ID, SENDER_DOMAIN } from '../config/env';

export async function senderSubscribe(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Sender.net: Subscribing email:', email);
    console.log('📧 Sender.net: Variables:', vars);
    
    const apiKey = SENDER_API_KEY;
    const domain = SENDER_DOMAIN;
    const listId = SENDER_LIST_ID;
    
    // Sender.net uses a different API structure for subscriptions
    const response = await axios.post(`https://api.sender.net/v2/subscribers`, {
      email: email,
      list_id: listId, // This should be your list ID from Sender.net
      status: 'subscribed',
      custom_fields: vars
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sender.net: Successfully subscribed:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to subscribe:', error);
    throw error;
  }
}

export async function senderUnsubscribe(email: string) {
  try {
    console.log('📧 Sender.net: Unsubscribing email:', email);
    
    const apiKey = SENDER_API_KEY;
    const domain = SENDER_DOMAIN;
    const listId = SENDER_LIST_ID;
    
    // Sender.net unsubscribe endpoint
    const response = await axios.put(`https://api.sender.net/v2/subscribers/${email}`, {
      status: 'unsubscribed'
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sender.net: Successfully unsubscribed:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to unsubscribe:', error);
    throw error;
  }
}

export async function senderGetSubscriber(email: string) {
  try {
    console.log('📧 Sender.net: Getting subscriber:', email);
    
    const apiKey = SENDER_API_KEY;
    const domain = SENDER_DOMAIN;
    
    const response = await axios.get(`https://api.sender.net/v2/subscribers/${email}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sender.net: Successfully retrieved subscriber:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to get subscriber:', error);
    throw error;
  }
}

export async function senderUpdateSubscriber(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Sender.net: Updating subscriber:', email);
    console.log('📧 Sender.net: Variables:', vars);
    
    const apiKey = SENDER_API_KEY;
    
    const response = await axios.put(`https://api.sender.net/v2/subscribers/${email}`, {
      custom_fields: vars
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sender.net: Successfully updated subscriber:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sender.net: Failed to update subscriber:', error);
    throw error;
  }
}
