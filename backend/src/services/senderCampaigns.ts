// backend/src/services/senderCampaigns.ts
import { senderAxios } from '../utils/senderAxios';
import { logger } from '../utils/logger';
import { createCache, CACHE_CONFIG } from '../utils/cache';
import { getFrontendUrl } from '../config/urls';
import { limitConcurrency } from '../utils/concurrency';
import { toSnippet } from '../utils/sanitizer';

const SENDER_LIST_ID = process.env.SENDER_LIST_ID;

// Retry wrapper with exponential backoff for Sender API calls
async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 300): Promise<T> {
  let err;
  for (let i = 0; i < tries; i++) {
    try { 
      return await fn(); 
    } catch (e: any) {
      err = e;
      const s = base * Math.pow(2, i);
      if (i === tries - 1) break;
      logger.debug(`📧 NewsletterCampaign: Retry ${i + 1}/${tries} after ${s}ms delay for transient error: ${e?.message}`);
      await new Promise(r => setTimeout(r, s));
    }
  }
  throw err;
}

const rawCampaignsCache = createCache<string, CampaignLite[]>(CACHE_CONFIG.TTL.RAW_CAMPAIGNS);
const processedResultsCache = createCache<string, PaginatedCampaignResponse>(CACHE_CONFIG.TTL.PROCESSED_RESULTS);

// Fetch preview data for a single campaign
async function fetchPreview(id: string) {
  try {
    const r = await withRetry(() => 
      senderAxios.get(`/campaigns/${encodeURIComponent(id)}`, { 
        headers: { Accept: 'application/json' } 
      })
    );
    const campaign = r.data?.data ?? r.data ?? {};
    
    // Check multiple possible locations for thumbnail URL
    let previewImageUrl: string | undefined;
    
    // First check campaign.html.thumbnail_url
    if (campaign.html?.thumbnail_url) {
      previewImageUrl = campaign.html.thumbnail_url;
    }
    // Fallback to campaign.thumbnail_url
    else if (campaign.thumbnail_url) {
      previewImageUrl = campaign.thumbnail_url;
    }
    // Other fallbacks
    else if (campaign.html?.image_url) {
      previewImageUrl = campaign.html.image_url;
    }
    else if (campaign.image_url) {
      previewImageUrl = campaign.image_url;
    }
    
    const htmlObj = campaign.html || {};
    const html = htmlObj.html_content || htmlObj.html_body;
    const previewSnippet = toSnippet(html);
    
    return { 
      previewImageUrl: previewImageUrl ?? null, 
      previewSnippet: previewSnippet ?? null 
    };
  } catch (error) {
    logger.warn(`📧 NewsletterCampaign: Failed to fetch preview for campaign ${id}: ${error?.message}`);
    return { previewImageUrl: null, previewSnippet: null };
  }
}

export interface CampaignLite {
  id: string;
  title?: string;
  subject?: string;
  status?: string;
  html?: string;
  content?: string;
  editor_html?: string;
  created?: string;
  modified?: string;
  sent_time?: string;
  send_to_all?: boolean;
  campaign_groups?: string[];
}

// Processed campaign data that matches the frontend NewsletterCampaign interface
export interface ProcessedCampaign {
  id: string;
  name: string;
  subject: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  canEmbed: boolean;
  absoluteViewUrl: string; // Full URL for all purposes
  previewImageUrl?: string | null;
  previewSnippet?: string | null;
}

export interface PaginatedCampaignResponse {
  campaigns: ProcessedCampaign[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
}

/**
 * Fetch campaigns with smart pagination - stops when we have enough sent campaigns
 * for the target list to satisfy the requested page and limit
 */
async function fetchCampaignsSmart(listId: string, targetCount: number): Promise<CampaignLite[]> {
  const sentCampaigns: CampaignLite[] = [];
  const seenIds = new Set<string>(); // Track seen campaign IDs to prevent duplicates
  let page = 1;
  let totalFetched = 0;
  
  // Calculate buffer: fetch extra to account for filtering and ensure we have enough
  const buffer = Math.ceil(targetCount * 0.3); // 30% buffer
  const fetchTarget = targetCount + buffer;
  
  while (sentCampaigns.length < fetchTarget) {
    const res = await withRetry(() => 
      senderAxios.get('/campaigns', { params: { page, per_page: 100 } })
    );
    const data = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data)
      ? res.data
      : [];
    
    if (data.length === 0) break;
    totalFetched += data.length;
    
    // Process this page to find sent campaigns for our list
    const emailLike = (c: CampaignLite) => !!(c.title || c.subject || c.sent_time);
    const sent = data.filter((c: CampaignLite) => 
      emailLike(c) && 
      ['sent', 'finished', 'completed', 'delivered'].includes((c.status || '').toLowerCase())
    );
    
    // Only collect campaigns sent to our target list
    const forOurList = sent.filter((c: CampaignLite) => {
      // Include campaigns sent to ALL recipients
      if (c.send_to_all) return true;
      
      // Include campaigns sent to our specific list
      const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
      return groups.includes(listId);
    });
    
    // Add only unique campaigns we haven't seen before
    for (const campaign of forOurList) {
      if (!seenIds.has(campaign.id)) {
        seenIds.add(campaign.id);
        sentCampaigns.push(campaign);
      }
    }
    
    // Stop if we have enough campaigns to satisfy the request + buffer
    if (sentCampaigns.length >= fetchTarget) {
      logger.debug(`📧 NewsletterCampaign: Stopped fetching at page ${page}, found ${sentCampaigns.length} campaigns for list ${listId} (target: ${fetchTarget})`);
      break;
    }
    
    // Check if there are more pages
    const meta = res.data?.meta || {};
    const hasMore =
      Boolean(meta?.next_page) ||
      (typeof meta?.current_page === 'number' && typeof meta?.last_page === 'number'
        ? meta.current_page < meta.last_page
        : (Array.isArray(data) && data.length === 100));
    
    if (!hasMore) break;
    page += 1;
    
    // Safety check: don't fetch more than 20 pages (2000 campaigns) to prevent infinite loops
    if (page > 20) {
      logger.warn(`📧 NewsletterCampaign: Safety limit reached at page ${page}, stopping fetch`);
      break;
    }
  }
  
  logger.debug(`📧 NewsletterCampaign: Smart fetch completed: fetched ${totalFetched} total campaigns, collected ${sentCampaigns.length} unique sent campaigns for list ${listId}`);
  return sentCampaigns;
}

/**
 * Get cached raw campaigns or fetch them if needed
 */
async function getRawCampaigns(listId: string, page: number = 1, limit: number = 20): Promise<CampaignLite[]> {
  const cacheKey = `raw:${listId}:${page}:${limit}`;
  const cached = rawCampaignsCache.get(cacheKey);
  
  if (cached) {
    logger.debug(`📧 NewsletterCampaign: Serving raw campaigns from cache for listId: ${listId}, page: ${page}, limit: ${limit}`);
    return cached;
  }
  
  // Calculate how many campaigns we need to fetch
  const targetCount = page * limit;
  const startTime = Date.now();
  logger.debug(`📧 NewsletterCampaign: Fetching raw campaigns for listId: ${listId}, page: ${page}, limit: ${limit}, target: ${targetCount}`);
  const campaigns = await fetchCampaignsSmart(listId, targetCount);
  const fetchTime = Date.now() - startTime;
  
  logger.info(`📧 NewsletterCampaign: Smart fetch completed in ${fetchTime}ms for listId: ${listId}, collected ${campaigns.length} campaigns`);
  
  // Cache the raw data
  rawCampaignsCache.set(cacheKey, campaigns);
  
  return campaigns;
}

/**
 * Return only SENT campaigns that targeted the given list.
 */
export async function getSentCampaignsForList(listId = SENDER_LIST_ID, page: number = 1, limit: number = 20): Promise<PaginatedCampaignResponse> {
  if (!SENDER_LIST_ID) throw new Error('Sender.net list ID not configured');

  // Fast-path: serve processed result from cache if fresh
  const processedCacheKey = `processed:${listId}:${page}:${limit}`;
  const cachedResult = processedResultsCache.get(processedCacheKey);
  if (cachedResult) {
    logger.debug(`📧 NewsletterCampaign: Serving processed result from cache for listId: ${listId}, page: ${page}, limit: ${limit}`);
    return cachedResult;
  }

  // Get raw campaigns (from cache if possible)
  const rawCampaigns = await getRawCampaigns(listId, page, limit);
  
  // Handle SMS or other campaign types gracefully
  const emailLike = (c: CampaignLite) => !!(c.title || c.subject || c.sent_time);
  const allEmailish = rawCampaigns.filter(emailLike);
  
  // Only "sent" (be tolerant of wording)
  const sent = allEmailish.filter((c: CampaignLite) =>
    ['sent', 'finished', 'completed', 'delivered']
      .includes((c.status || '').toLowerCase())
  );
  
  // Show campaigns sent to following groups:
  const finalCampaigns = sent.filter((c: CampaignLite) => {
    // Include campaigns sent to ALL recipients
    if (c.send_to_all) return true;
    
    // Include campaigns sent to our specific list
    const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
    return groups.includes(listId);
  });
  
  // Sort by date (newest first)
  finalCampaigns.sort((a: CampaignLite, b: CampaignLite) =>
    (new Date(b.sent_time || b.created || 0).getTime()
     - new Date(a.sent_time || a.created || 0).getTime())
  );
  
  // Apply pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedCampaigns = finalCampaigns.slice(startIndex, endIndex);
  
  // Map to consistent format
  const result: ProcessedCampaign[] = paginatedCampaigns.map((c: CampaignLite) => {
    const campaign: ProcessedCampaign = {
      id: c.id,
      name: c.title || c.subject || 'Untitled Campaign',
      subject: c.subject || 'No Subject',
      createdAt: c.created || '',
      updatedAt: c.modified || '',
      sentAt: c.sent_time,
      canEmbed: true, // Always true since we're using Sender API
      // Use absolute URL for all purposes - no need for relative viewUrl
      absoluteViewUrl: `${getFrontendUrl()}/api/newsletter/reader/${encodeURIComponent(c.id)}/view`,
      // Preview fields will be populated by enrichment if needed
      previewImageUrl: null,
      previewSnippet: null,
    };

    logger.debug(`📧 NewsletterCampaign: Populating fields for campaign ID: ${c.id}`, {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      sentAt: campaign.sentAt,
      canEmbed: campaign.canEmbed,
      absoluteViewUrl: campaign.absoluteViewUrl,
    });

    return campaign;
  });

  const response = {
    campaigns: result,
    total: finalCampaigns.length,
    page,
    limit,
    hasMore: endIndex < finalCampaigns.length,
    totalPages: Math.ceil(finalCampaigns.length / limit),
  };

  // Cache the processed result
  processedResultsCache.set(processedCacheKey, response);

  return response;
}

/**
 * Get enriched campaigns with additional data from Sender API
 */
export async function getEnrichedCampaignsForList(listId = SENDER_LIST_ID, page: number = 1, limit: number = 20): Promise<PaginatedCampaignResponse> {
  const base = await getSentCampaignsForList(listId, page, limit);

  // Enrich concurrently but politely (4 at a time)
  const enriched: ProcessedCampaign[] = await limitConcurrency(
    base.campaigns,
    4,
    async (c: ProcessedCampaign) => {
      const { previewImageUrl, previewSnippet } = await fetchPreview(c.id);
      return { ...c, previewImageUrl, previewSnippet };
    }
  );

  return { ...base, campaigns: enriched };
}