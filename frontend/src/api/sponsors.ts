import { API_URL } from '../config/environment';
import { logger } from '../utils/logger';
import { NewsletterCampaign } from '../types';

interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  try {
    const response = await fetch(`${API_URL}/sponsors`);
    if (!response.ok) {
      throw new Error('Failed to fetch sponsors');
    }
    return await response.json();
  } catch (error) {
    logger.error('Error fetching sponsors:', error);
    return [];
  }
}

export async function getNewsletterCampaigns(listId?: string): Promise<NewsletterCampaign[]> {
  try {
    const qs = listId ? `?listId=${encodeURIComponent(listId)}` : '';
    const response = await fetch(`${API_URL}/newsletter/campaigns${qs}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch newsletter campaigns: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    logger.error('Error fetching newsletter campaigns:', error);
    throw error;
  }
} 
