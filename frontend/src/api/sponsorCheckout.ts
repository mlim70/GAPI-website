// frontend/src/api/sponsorCheckout.ts
import { env } from '../config/environment';
import { logger } from '../utils/logger';

export interface SponsorCheckoutData {
  amount: number;
  email: string;
  name: string;
  company?: string;
  phone?: string;
  message?: string;
  tierName?: string;
}

export interface SponsorCheckoutResponse {
  sessionUrl: string;
  sessionId: string;
}

export async function createSponsorCheckout(data: SponsorCheckoutData): Promise<SponsorCheckoutResponse> {
  try {
    const apiUrl = `${env.apiUrl}/sponsor/checkout/sponsor`;
    logger.info('🚀 Starting sponsor checkout:', { 
      amount: data.amount, 
      email: data.email,
      apiUrl: apiUrl
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    logger.info('📡 API Response:', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ API Error Response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    logger.info('✅ Sponsor checkout session created successfully:', result);
    
    return result;
  } catch (error) {
    logger.error('❌ Error creating sponsor checkout:', error);
    throw error;
  }
}
