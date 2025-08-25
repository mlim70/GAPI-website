import { API_URL } from '../config/environment';
import { logger } from '../utils/logger';

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
