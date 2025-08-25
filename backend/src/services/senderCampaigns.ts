// backend/src/services/senderCampaigns.ts
import axios from 'axios';
import { SENDER_API_KEY, SENDER_LIST_ID } from '../config/env';

// Legacy fallback for extracting HTML from various payload shapes
function extractHtml(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const tries = [
    obj.html,
    obj.content,
    obj.editor_html,
    obj.editor?.html,
    obj.editor?.content,
    obj.reports?.html,
  ];
  const hit = tries.find(v => typeof v === 'string' && v.trim().length);
  return (typeof hit === 'string' && hit.trim()) ? hit : null;
}

function deepFindUrl(obj: any): string | null {
  const urls: string[] = [];
  const stack = [obj];
  while (stack.length) {
    const curr = stack.pop();
    if (!curr) continue;
    if (typeof curr === 'string') {
      const m = curr.match(/https?:\/\/[^\s"']+/i);
      if (m) urls.push(m[0]);
    } else if (Array.isArray(curr)) {
      curr.forEach(v => stack.push(v));
    } else if (typeof curr === 'object') {
      Object.values(curr).forEach(v => stack.push(v));
    }
  }
  // Prefer Sender domains if we find multiple
  const senderish = urls.find(u => /sender\.net|share\.sender\.net|app\.sender\.net/i.test(u));
  return senderish || urls[0] || null;
}

function pickHtmlFromDetail(payload: any): string | null {
  const item = payload?.data ?? payload; // <-- unwrap
  const h = item?.html;
  if (typeof h === 'string' && h.trim()) return h;
  if (h && typeof h === 'object') {
    // prefer raw links (no tracking placeholders)
    if (typeof h.html_content === 'string' && h.html_content.trim()) return h.html_content;
    if (typeof h.html_body === 'string' && h.html_body.trim()) return h.html_body;
  }
  // legacy fallbacks
  return extractHtml(item);
}

function massageHtmlForPublic(html: string) {
  return html
    // drop open-pixel
    .replace(/<img[^>]+campaign-statistics\.com\/email_open\/\[EMAIL_ID\][^>]*>/gi, '')
    // neutralize "browser preview" placeholders
    .replace(/\[BROWSER_PREVIEW\]/gi, '#')
    .replace(/https?:\/\/campaign-statistics\.com\/browser_preview\/\[EMAIL_ID\]/gi, '#')
    // optional: strip link-tracking placeholders (leave the text)
    .replace(/https?:\/\/campaign-statistics\.com\/link_click\/\[EMAIL_ID\]\/[a-f0-9]+/gi, '#');
}

// simple per-list cache with TTL
const CACHE_TTL_MS = 60_000; // 60s; bump to 120_000 or more if you like
type CacheEntry<T> = { data: T; expires: number };
const sentCampaignsCache = new Map<string, CacheEntry<any[]>>();
// cache raw HTML by campaign id (longer TTL is fine: content is immutable once sent)
const CAMPAIGN_HTML_TTL_MS = 60 * 60 * 1000; // 1h
const campaignHtmlCache = new Map<string, CacheEntry<string>>();

const AX = axios.create({
  baseURL: 'https://api.sender.net/v2',
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${SENDER_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export interface CampaignLite {
  id: string;
  title?: string;
  subject?: string;
  status?: string;
  html?: string;
  created?: string;
  modified?: string;
  sent_time?: string;
  send_to_all?: boolean;
  campaign_groups?: string[];
  reports?: any;
}


async function listAllCampaigns(): Promise<CampaignLite[]> {
  const all: CampaignLite[] = [];
  let page = 1;
  while (true) {
    const res = await AX.get('/campaigns', { params: { page, per_page: 100 } });
    const data = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data)
      ? res.data
      : [];
    all.push(...data);
    
    // Robust pagination detection
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
 * Return only SENT campaigns that targeted the given list.
 */
export async function getSentCampaignsForList(listId = SENDER_LIST_ID) {
  
  if (!SENDER_API_KEY) throw new Error('Sender.net API key not configured');
  if (!listId) throw new Error('Sender.net list ID not configured');

  // fast-path: serve from cache if fresh
  const now = Date.now();
  const cached = sentCampaignsCache.get(listId);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const all = await listAllCampaigns();
  
  // Handle SMS or other campaign types gracefully
  const emailLike = (c: any) => !!(c.subject || c.name || c.sent_time);
  const allEmailish = all.filter(emailLike);
  
  // Only "sent" (be tolerant of wording)
  const sent = allEmailish.filter((c: CampaignLite) =>
    ['sent', 'finished', 'completed', 'delivered']
      .includes((c.status || '').toLowerCase())
  );
  
  // Include if: sent to all OR targeted your list via campaign_groups
  const finalCampaigns = sent.filter((c: CampaignLite) => {
    if (c.send_to_all) return true;
    const groups = Array.isArray(c.campaign_groups) ? c.campaign_groups : [];
    return groups.includes(listId);
  });
  
    // Save any HTML we already have from the list payload (fast path for /open)
  for (const c of finalCampaigns) {
    const h: any = (c as any).html;
    const html =
      (typeof h === 'string' && h) ||
      (h && (h.html_content || h.html_body)) || null;
    if (typeof html === 'string' && html.trim()) {
      const safe = massageHtmlForPublic(html);
      campaignHtmlCache.set(c.id, { data: safe, expires: now + CAMPAIGN_HTML_TTL_MS });
    }
  }
  
  // Map the right field names from the list payload
  const result = finalCampaigns
    .map((c: any) => {
      const reports = c.reports || {};
      const publicUrl =
        reports.public_url ||
        reports.web_link ||
        reports.share_url ||
        c.public_url ||
        c.share_url ||
        c.archive_url ||
        deepFindUrl(reports) ||
        deepFindUrl(c) ||
        null;
      
      return {
        id: c.id,
        name: c.title || c.subject || 'Untitled Campaign',
        subject: c.subject || 'No Subject',
        createdAt: c.created,
        updatedAt: c.modified,
        sentAt: c.sent_time,
        publicUrl,
      };
    })
    .sort((a: any, b: any) =>
      (new Date(b.sentAt || b.createdAt || 0).getTime()
       - new Date(a.sentAt || a.createdAt || 0).getTime())
    );

  // store in cache
  sentCampaignsCache.set(listId, { data: result, expires: now + CACHE_TTL_MS });

  return result;
}

// --- add: resolve campaign open target (redirect URL or raw HTML) ---
export async function resolveCampaignOpenTarget(id: string): Promise<{ url?: string; html?: string }> {
  // 0) In-memory HTML first
  const cached = campaignHtmlCache.get(id);
  if (cached && cached.expires > Date.now() && cached.data.trim()) {
    return { html: cached.data };
  }

  // 1) Detail endpoint
  try {
    const res = await AX.get(`/campaigns/${id}`);
    const item = res.data?.data ?? res.data ?? {};
    
    // try share-like URLs anywhere in the detail
    const share =
      item?.reports?.public_url ||
      item?.reports?.web_link ||
      item?.reports?.share_url ||
      item?.public_url ||
      item?.share_url ||
      deepFindUrl(item) || null;

    if (share && /^https?:\/\//i.test(share)) {
      return { url: share };
    }

    const html = pickHtmlFromDetail(res.data);
    if (html) {
      const safe = massageHtmlForPublic(html);
      campaignHtmlCache.set(id, { data: safe, expires: Date.now() + CAMPAIGN_HTML_TTL_MS });
      return { html: safe };
    }
  } catch (error) {
    // Continue to next fallback
  }

  // 2) Nothing
  return {};
}