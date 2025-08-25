// backend/src/services/senderCampaigns.ts
import { senderAxios } from '../utils/senderAxios';
import { logger } from '../utils/logger';

const SENDER_LIST_ID = process.env.SENDER_LIST_ID;

// Cache TTLs
const RAW_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for raw data
const PROCESSED_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for processed results
const CACHE_VERSION = 'v4'; // Bump version when cache structure changes

// Cache hygiene - prevent unbounded growth
const MAX_CACHE_KEYS = 500;
function setWithCap<K, V>(m: Map<K, V>, k: K, v: V) {
  if (m.size >= MAX_CACHE_KEYS) m.delete(m.keys().next().value);
  m.set(k, v);
}

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

type CacheEntry<T> = { data: T; expires: number };
const rawCampaignsCache = new Map<string, CacheEntry<CampaignLite[]>>();
const processedResultsCache = new Map<string, CacheEntry<PaginatedCampaignResponse>>();

// Simple concurrency limiter
async function limitConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = [];
  const chunks = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  
  return results;
}

// Extract text snippet from HTML content
function toSnippet(html?: string, max = 160): string | undefined {
  if (!html || typeof html !== 'string') return undefined;
  
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Clean up template variables and placeholder content
  text = text
    .replace(/\{\$[^}]+\}/g, '') // Remove {$subject} type variables
    .replace(/\{\{[^}]+\}\}/g, '') // Remove {{ subject }} type variables
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\s+/g, ' ') // Clean up excessive whitespace
    .trim();
  
  return text ? (text.length > max ? text.slice(0, max - 1) + '…' : text) : undefined;
}

// Fetch preview data for a single campaign
async function fetchPreview(id: string) {
  try {
    const r = await withRetry(() => 
      senderAxios.get(`/campaigns/${encodeURIComponent(id)}`, { 
        headers: { Accept: 'application/json' } 
      })
    );
    const campaign = r.data?.data ?? r.data ?? {};
    const htmlObj = campaign.html || {};
    const previewImageUrl: string | undefined = htmlObj.thumbnail_url;
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

export interface PaginatedCampaignResponse {
  campaigns: any[];
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
  const all: CampaignLite[] = [];
  let page = 1;
  let sentCount = 0;
  
  while (true) {
    const res = await withRetry(() => 
      senderAxios.get('/campaigns', { params: { page, per_page: 100 } })
    );
    const data = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data)
      ? res.data
      : [];
    
    if (data.length === 0) break;
    all.push(...data);
    
    // Process this page to count sent campaigns for our list
    const emailLike = (c: any) => !!(c.title || c.subject || c.sent_time);
    const sent = data.filter((c: CampaignLite) => 
      emailLike(c) && 
      ['sent', 'finished', 'completed', 'delivered'].includes((c.status || '').toLowerCase())
    );
    
    // Count campaigns sent to our target list
    const forOurList = sent.filter((c: CampaignLite) => {
      const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
      return groups.includes(listId);
    });
    
    sentCount += forOurList.length;
    
    // Stop if we have enough campaigns to satisfy the request
    if (sentCount >= targetCount) {
      logger.debug(`📧 NewsletterCampaign: Stopped fetching at page ${page}, found ${sentCount} campaigns for list ${listId}`);
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
  }
  
  return all;
}

/**
 * Get cached raw campaigns or fetch them if needed
 */
async function getRawCampaigns(listId: string): Promise<CampaignLite[]> {
  const now = Date.now();
  const cacheKey = `${CACHE_VERSION}:raw:${listId}`;
  const cached = rawCampaignsCache.get(cacheKey);
  
  if (cached && cached.expires > now) {
    logger.debug(`📧 NewsletterCampaign: Serving raw campaigns from cache for listId: ${listId}`);
    return cached.data;
  }
  
  logger.debug(`📧 NewsletterCampaign: Fetching raw campaigns for listId: ${listId}`);
  const campaigns = await fetchCampaignsSmart(listId, 1000); // Fetch up to 1000 campaigns
  
  // Cache the raw data
  setWithCap(rawCampaignsCache, cacheKey, { data: campaigns, expires: now + RAW_CACHE_TTL_MS });
  
  return campaigns;
}

/**
 * Return only SENT campaigns that targeted the given list.
 */
export async function getSentCampaignsForList(listId = SENDER_LIST_ID, page: number = 1, limit: number = 20): Promise<PaginatedCampaignResponse> {
  if (!SENDER_LIST_ID) throw new Error('Sender.net list ID not configured');

  // Fast-path: serve processed result from cache if fresh
  const now = Date.now();
  const processedCacheKey = `${CACHE_VERSION}:processed:${listId}:${page}:${limit}`;
  const cachedResult = processedResultsCache.get(processedCacheKey);
  if (cachedResult && cachedResult.expires > now) {
    logger.debug(`📧 NewsletterCampaign: Serving processed result from cache for listId: ${listId}, page: ${page}, limit: ${limit}`);
    return cachedResult.data;
  }

  // Get raw campaigns (from cache if possible)
  const rawCampaigns = await getRawCampaigns(listId);
  
  // Handle SMS or other campaign types gracefully
  const emailLike = (c: any) => !!(c.title || c.subject || c.sent_time);
  const allEmailish = rawCampaigns.filter(emailLike);
  
  // Only "sent" (be tolerant of wording)
  const sent = allEmailish.filter((c: CampaignLite) =>
    ['sent', 'finished', 'completed', 'delivered']
      .includes((c.status || '').toLowerCase())
  );
  
  // Show campaigns sent to following groups:
  const finalCampaigns = sent.filter((c: CampaignLite) => {
    const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
    return groups.includes(listId);
  });
  
  // Sort by date (newest first)
  finalCampaigns.sort((a: any, b: any) =>
    (new Date(b.sent_time || b.created || 0).getTime()
     - new Date(a.sent_time || a.created || 0).getTime())
  );
  
  // Apply pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedCampaigns = finalCampaigns.slice(startIndex, endIndex);
  
  // Map to consistent format
  const result = paginatedCampaigns.map((c: any) => {
    const campaign = {
      id: c.id,
      name: c.title || c.subject || 'Untitled Campaign',
      subject: c.subject || 'No Subject',
      createdAt: c.created,
      updatedAt: c.modified,
      sentAt: c.sent_time,
      canEmbed: true, // Always true since we're using Sender API
      viewUrl: `/api/newsletter/reader/${encodeURIComponent(c.id)}/view`,
    };

    logger.debug(`📧 NewsletterCampaign: Populating fields for campaign ID: ${c.id}`, {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      sentAt: campaign.sentAt,
      canEmbed: campaign.canEmbed,
      viewUrl: campaign.viewUrl,
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
  setWithCap(processedResultsCache, processedCacheKey, { data: response, expires: now + PROCESSED_CACHE_TTL_MS });

  return response;
}

/**
 * Get enriched campaigns with additional data from Sender API
 */
export async function getEnrichedCampaignsForList(listId = SENDER_LIST_ID, page: number = 1, limit: number = 20): Promise<PaginatedCampaignResponse> {
  const base = await getSentCampaignsForList(listId, page, limit);

  // Enrich concurrently but politely (4 at a time)
  const enriched = await limitConcurrency(
    base.campaigns,
    4,
    async (c) => {
      const { previewImageUrl, previewSnippet } = await fetchPreview(c.id);
      return { ...c, previewImageUrl, previewSnippet };
    }
  );

  return { ...base, campaigns: enriched };
}