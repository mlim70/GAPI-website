//frontend/src/api/newsletter.ts
import { API_URL } from '../config/environment';
import { logger } from '../utils/logger';
import { NewsletterCampaign } from '../types';

export async function getEnrichedNewsletterCampaigns(listId?: string, page: number = 1, limit: number = 10): Promise<{ campaigns: NewsletterCampaign[]; total: number; page: number; limit: number; hasMore: boolean }> {
  try {
    const qs = new URLSearchParams();
    if (listId) qs.append('listId', listId);
    qs.append('enriched', 'true');
    qs.append('page', page.toString());
    qs.append('limit', limit.toString());
    
    const response = await fetch(`${API_URL}/newsletter/campaigns?${qs}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch enriched newsletter campaigns: ${response.statusText}`);
    }

    const result = await response.json();
    
    // The backend returns { success: true, data: PaginatedResponse }
    // where data contains the paginated structure
    if (result.success && result.data) {
      const campaigns = result.data.campaigns || [];
      
      // Log what fields are being received for enriched campaigns
      logger.debug('📧 NewsletterCampaign: Received enriched campaigns from API:', {
        listId,
        page,
        limit,
        totalCampaigns: campaigns.length,
        total: result.data.total,
        hasMore: result.data.hasMore,
        campaigns: campaigns.map((campaign: NewsletterCampaign) => ({
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          sentAt: campaign.sentAt,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
          canEmbed: campaign.canEmbed,
          hasViewUrl: !!campaign.absoluteViewUrl
        }))
      });
      
      return {
        campaigns,
        total: result.data.total || 0,
        page: result.data.page || page,
        limit: result.data.limit || limit,
        hasMore: result.data.hasMore || false
      };
    }
    
    // Fallback for unexpected response structure
    logger.warn('📧 NewsletterCampaign: Unexpected response structure, using fallback:', result);
    return {
      campaigns: [],
      total: 0,
      page,
      limit,
      hasMore: false
    };
  } catch (error) {
    logger.error('Error fetching enriched newsletter campaigns:', error);
    throw error;
  }
}
