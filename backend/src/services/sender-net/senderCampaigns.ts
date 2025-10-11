// backend/src/services/senderCampaigns.ts
import { senderAxios } from '../../utils/email/senderAxios';
import { logger } from '../../utils/general/logger';
import { createCache, CACHE_CONFIG } from '../../utils/general/cache';
import { getFrontendUrl } from '../../config/urls';
import { limitConcurrency } from '../../utils/general/concurrency';
import { toSnippet } from '../../utils/security/sanitizer';

const SENDER_LIST_ID = process.env.SENDER_LIST_ID;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Normalize dates to ISO once
function toIso(x?: string): string {
  try { return x ? new Date(x).toISOString() : ''; } catch { return ''; }
}

// Retries (429/5xx only) + jitter + Retry-After
async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 300): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      const code = e?.code;
      const networkish = !status && !!code;
      const retryable = status === 429 || (status >= 500 && status < 600) || networkish;
      if (!retryable || i === tries - 1) break;

      let delay = base * Math.pow(2, i);
      const ra = e?.response?.headers?.['retry-after'];
      if (ra) {
        const num = Number(ra);
        if (!Number.isNaN(num)) {
          delay = Math.max(delay, num * 1000);
        } else {
          const ts = Date.parse(ra); // HTTP-date
          if (!Number.isNaN(ts)) {
            delay = Math.max(delay, ts - Date.now());
          }
        }
      }
      // +/- 20% jitter
      const jitter = delay * (0.8 + Math.random() * 0.4);
      logger.debug(`📧 NewsletterCampaign: Retry ${i + 1}/${tries} after ${Math.round(jitter)}ms (status ${status})`);
      await sleep(jitter);
    }
  }
  throw lastErr;
}

// Cache for full campaign list - single source of truth
const fullCampaignsCache = createCache<string, CampaignLite[]>(CACHE_CONFIG.TTL.RAW_CAMPAIGNS);

// Preview cache to avoid duplicate fetches across pages
const previewCache = createCache<string, { previewImageUrl: string | null; previewSnippet: string | null }>(
  CACHE_CONFIG.TTL.PREVIEW ?? 10 * 60 * 1000
);

// Fetch preview data for a single campaign with caching
async function fetchPreview(id: string) {
  const hit = previewCache.get(id);
  if (hit) return hit;
  
  try {
    const r = await withRetry(() =>
      senderAxios.get(`/campaigns/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
    );
    const campaign = r.data?.data ?? r.data ?? {};
    const htmlObj = campaign.html || {};
    const html = htmlObj.html_content || htmlObj.html_body || campaign.editor_html || campaign.content || campaign.html;

    // Robust thumb extraction
    const thumbCandidates = [
      campaign.html?.thumbnail_url,
      campaign.thumbnail_url,
      campaign.html?.image_url,
      campaign.image_url,
      campaign?.reports?.thumbnail_url,
    ].filter(Boolean);

    const value = {
      previewImageUrl: (thumbCandidates[0] as string | undefined) ?? null,
      previewSnippet: toSnippet(html) ?? null,
    };
    previewCache.set(id, value);
    return value;
  } catch (error: any) {
    logger.warn(`📧 NewsletterCampaign: Failed to fetch preview for campaign ${id}: ${error?.message}`);
    const value = { previewImageUrl: null, previewSnippet: null };
    previewCache.set(id, value);
    return value;
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
 * Fetch all campaigns with smart pagination - fetches everything once
 * and stops when we have enough sent campaigns for the target list
 */
async function fetchAllCampaigns(listId: string): Promise<CampaignLite[]> {
  const sentCampaigns: CampaignLite[] = [];
  const seenIds = new Set<string>(); // Track seen campaign IDs to prevent duplicates
  let page = 1;
  let totalFetched = 0;
  
  const maxPages = 20;
  
  // Add timeout protection
  const startTime = Date.now();
  const maxFetchTime = 60000; // 60 seconds max
  
  while (true) {
    if (page > maxPages) {
      logger.warn(`📧 NewsletterCampaign: Safety limit reached at page ${page}, stopping fetch`);
      break;
    }
    
    // Add timeout check
    if (Date.now() - startTime > maxFetchTime) {
      logger.warn(`📧 NewsletterCampaign: Fetch timeout reached for listId: ${listId}`);
      break;
    }
    
    logger.debug(`📧 NewsletterCampaign: Fetching page ${page} from Sender API`);
    const res = await withRetry(() => 
      senderAxios.get('/campaigns', { params: { page, per_page: 100 } })
    );
    const data = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data)
      ? res.data
      : [];
    
    logger.debug(`📧 NewsletterCampaign: Page ${page} returned ${data.length} campaigns`);
    
    if (data.length === 0) break;
    totalFetched += data.length;
    
    // Process this page to find sent campaigns for our list
    const emailLike = (c: CampaignLite) => !!(c.title || c.subject || c.sent_time);
    const sent = data.filter((c: CampaignLite) => 
      emailLike(c) && 
      ['sent', 'finished', 'completed', 'delivered'].includes((c.status || '').toLowerCase())
    );
    
    logger.debug(`📧 NewsletterCampaign: Page ${page} - ${sent.length} sent campaigns found out of ${data.length} total`);
    
    // Only collect campaigns sent to our target list
    const forOurList = sent.filter((c: CampaignLite) => {
      // Include campaigns sent to ALL recipients
      if (c.send_to_all) return true;
      
      // Include campaigns sent to our specific list
      const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
      const matches = groups.includes(listId);
      
      // Log campaigns that don't match for debugging
      if (!matches && !c.send_to_all) {
        logger.debug(`📧 NewsletterCampaign: Filtering out campaign "${c.title || c.subject}" - not sent to listId ${listId}`, {
          campaignId: c.id,
          campaignGroups: groups,
          sendToAll: c.send_to_all
        });
      }
      
      return matches;
    });
    
    // Add only unique campaigns we haven't seen before
    for (const campaign of forOurList) {
      if (!seenIds.has(campaign.id)) {
        seenIds.add(campaign.id);
        sentCampaigns.push(campaign);
      }
    }
    
    // Check if there are more pages
    const meta = res.data?.meta || {};
    const hasMore =
      Boolean(meta?.next_page) ||
      (typeof meta?.current_page === 'number' && typeof meta?.last_page === 'number'
        ? meta.current_page < meta.last_page
        : (Array.isArray(data) && data.length === 100));
    
    logger.debug(`📧 NewsletterCampaign: Page ${page} pagination info:`, {
      hasNextPage: Boolean(meta?.next_page),
      currentPage: meta?.current_page,
      lastPage: meta?.last_page,
      dataLength: data.length,
      hasMore
    });
    
    if (!hasMore) {
      logger.debug(`📧 NewsletterCampaign: No more pages, stopping fetch at page ${page}`);
      break;
    }
    page += 1;
  }
  
  logger.info(`📧 NewsletterCampaign: Full fetch completed: fetched ${totalFetched} total campaigns, collected ${sentCampaigns.length} unique sent campaigns for list ${listId}`);
  return sentCampaigns;
}

/**
 * Get cached full campaigns list or fetch them if needed
 */
async function getFullCampaignsList(listId: string): Promise<CampaignLite[]> {
  const cacheKey = `full:${listId}`;
  const cached = fullCampaignsCache.get(cacheKey);
  
  if (cached) {
    logger.debug(`📧 NewsletterCampaign: Serving full campaigns list from cache for listId: ${listId}`);
    return cached;
  }
  
  // Fetch all campaigns once
  const startTime = Date.now();
  logger.debug(`📧 NewsletterCampaign: Fetching full campaigns list for listId: ${listId}`);
  const campaigns = await fetchAllCampaigns(listId);
  const fetchTime = Date.now() - startTime;
  
  logger.info(`📧 NewsletterCampaign: Full fetch completed in ${fetchTime}ms for listId: ${listId}, collected ${campaigns.length} campaigns`);
  
  // Cache the full list
  fullCampaignsCache.set(cacheKey, campaigns);
  
  return campaigns;
}

/**
 * Return only SENT campaigns that targeted the given list.
 * Now handles pagination locally from cached full list.
 */
export async function getSentCampaignsForList(
  listIdParam?: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedCampaignResponse> {
  const listId = listIdParam ?? SENDER_LIST_ID;
  if (!listId) throw new Error('Sender.net list ID not configured');

  // Clamp page/limit and avoid negative indices
  page = Math.max(1, Math.floor(page));
  limit = Math.min(100, Math.max(1, Math.floor(limit))); // cap at 100

  // Get full campaigns list (already filtered and processed)
  const allCampaigns = await getFullCampaignsList(listId);
  
  // No need to filter again - campaigns are already processed and filtered
  const finalCampaigns = allCampaigns;
  
  // Sort without widening types - keep it local
  const sorted = [...finalCampaigns].sort((a, b) =>
    new Date(b.sent_time || b.created || 0).getTime() -
    new Date(a.sent_time || a.created || 0).getTime()
  );
  
  // Clamp and early-exit if page > total
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  page = Math.min(page, totalPages);
  
  // Recompute indices after clamping
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalItems);
  const paginatedCampaigns = sorted.slice(startIndex, endIndex);
  
  // Map to consistent format
  const result: ProcessedCampaign[] = paginatedCampaigns.map((c: CampaignLite) => {
    const campaign: ProcessedCampaign = {
      id: c.id,
      name: c.title || c.subject || 'Untitled Campaign',
      subject: c.subject || 'No Subject',
      createdAt: toIso(c.created),
      updatedAt: toIso(c.modified),
      sentAt: c.sent_time ? toIso(c.sent_time) : undefined,
      canEmbed: true, // Always true since we're using Sender API
      // Safer absolute URL construction - avoids double slashes and odd bases
      absoluteViewUrl: new URL(
        `/api/newsletter/reader/${encodeURIComponent(c.id)}/view`,
        getFrontendUrl()
      ).toString(),
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

  return {
    campaigns: result,
    total: totalItems,
    page,
    limit,
    hasMore: page < totalPages,
    totalPages,
  };
}

/**
 * Get enriched campaigns with additional data from Sender API
 */
export async function getEnrichedCampaignsForList(
  listIdParam?: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedCampaignResponse> {
  const listId = listIdParam ?? SENDER_LIST_ID;
  
  // Clamp page/limit and avoid negative indices
  page = Math.max(1, Math.floor(page));
  limit = Math.min(100, Math.max(1, Math.floor(limit))); // cap at 100
  
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