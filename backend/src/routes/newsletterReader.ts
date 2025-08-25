//newsletterReader.ts
import { Router } from 'express';
import * as cheerio from 'cheerio';
import { getSentCampaignsForList } from '../services/senderCampaigns';
import { senderAxios } from '../utils/senderAxios';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();
const HTML_CACHE = new Map<string, { body: string; exp: number }>();
const TTL = 10 * 60 * 1000;

// Cache hygiene - prevent unbounded growth
const MAX_CACHE_KEYS = 500;
function setWithCap<K, V>(m: Map<K, V>, k: K, v: V) {
  if (m.size >= MAX_CACHE_KEYS) m.delete(m.keys().next().value);
  m.set(k, v);
}

// Rate limiting to prevent scraping
const readerLimiter = createRateLimiter(100, 15 * 60 * 1000); // 100 views per 15 minutes per IP

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
      logger.debug(`📧 Newsletter reader: Retry ${i + 1}/${tries} after ${s}ms delay for transient error: ${e?.message}`);
      await new Promise(r => setTimeout(r, s));
    }
  }
  throw err;
}

// Test route to verify the router is mounted TODO
router.get('/test', (req, res) => {
  res.json({ message: 'Newsletter reader router is working', timestamp: new Date().toISOString() });
});

async function findCampaign(id: string) {
  const { campaigns } = await getSentCampaignsForList(undefined, 1, 500);
  const campaign = campaigns.find((c: any) => String(c.id) === String(id));
  return campaign || null;
}

async function fetchCampaignHtmlFromSender(id: string): Promise<string | null> {
  try {
    const r = await withRetry(() => 
      senderAxios.get(`/campaigns/${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' }
      })
    );
    
    const campaign = r.data?.data ?? r.data ?? {};

    // HTML lives under campaign.html.{html_content|html_body}
    const htmlObj = campaign.html;
    if (htmlObj && typeof htmlObj === 'object') {
      if (typeof htmlObj.html_content === 'string' && htmlObj.html_content.trim()) {
        logger.debug(`📧 Newsletter reader: Found html.html_content for campaign ID: ${id}`);
        return htmlObj.html_content as string; // cleaner (no tracking pixel)
      }
      if (typeof htmlObj.html_body === 'string' && htmlObj.html_body.trim()) {
        logger.debug(`📧 Newsletter reader: Found html.html_body for campaign ID: ${id}`);
        return htmlObj.html_body as string; // compiled version with tracking pixel
      }
    }

    logger.warn(`📧 Newsletter reader: No html_content/html_body present for campaign ID: ${id}`, { keys: Object.keys(campaign.html || {}) });
    return null;
  } catch (err) {
    logger.warn(`📧 Newsletter reader: Sender API fetch failed for campaign ID: ${id}`, err);
    return null;
  }
}

function addReaderHeaders(res: any) {
  res.set('Cache-Control', 'public, max-age=600');
  // Enhanced CSP: Allow images/styles from the web, but no scripts/frames. Inline styles ok for email HTML.
  // Removed http: from img-src for production security
  res.set(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "img-src https: data:",
      "style-src 'unsafe-inline' https:",
      "font-src https: data:",
      "connect-src 'none'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'none'",
      "object-src 'none'",
      "script-src 'none'",
    ].join('; ')
  );
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
}

function sanitize(html: string) {
  const $ = cheerio.load(html);
  
  let sanitizationLog = {
    scriptsRemoved: 0,
    eventHandlersRemoved: 0,
    dangerousUrlsRemoved: 0,
    dangerousElementsRemoved: 0,
    dangerousMetaTagsRemoved: 0,
    linksSecured: 0,
    templateVarsCleaned: 0,
    zeroWidthCharsCleaned: 0
  };
  
  // Remove all script-related elements and attributes
  const scripts = $('script, noscript');
  sanitizationLog.scriptsRemoved = scripts.length;
  scripts.remove();
  
  // Remove event handler attributes (onclick, onload, etc.)
  $('*').each((_, element) => {
    if (element.type === 'tag' && element.attribs) {
      Object.keys(element.attribs).forEach(attr => {
        if (attr.startsWith('on') && typeof element.attribs[attr] === 'string') {
          sanitizationLog.eventHandlersRemoved++;
          delete element.attribs[attr];
        }
      });
    }
  });
  
  // Remove dangerous URLs (javascript:, data:)
  $('*').each((_, element) => {
    if (element.type === 'tag' && element.attribs) {
      Object.keys(element.attribs).forEach(attr => {
        const value = element.attribs[attr];
        if (typeof value === 'string') {
          if (
            (attr === 'href' || attr === 'src') &&
            (value.toLowerCase().startsWith('javascript:') || value.toLowerCase().startsWith('data:'))
          ) {
            sanitizationLog.dangerousUrlsRemoved++;
            delete element.attribs[attr];
          }
        }
      });
    }
  });
  
  // Remove dangerous elements
  const dangerousElements = $('object, embed, applet, iframe, form, input, button, select, textarea');
  sanitizationLog.dangerousElementsRemoved = dangerousElements.length;
  dangerousElements.remove();
  
  // Remove dangerous meta tags
  const dangerousMeta = $('meta[http-equiv="refresh"], meta[http-equiv="set-cookie"]');
  sanitizationLog.dangerousMetaTagsRemoved = dangerousMeta.length;
  dangerousMeta.remove();
  
  // Secure all links: force target="_blank" and rel="noopener noreferrer"
  $('a[href]').each((_, el) => {
    const $a = $(el);
    $a.attr('target', '_blank');
    $a.attr('rel', 'noopener noreferrer');
    sanitizationLog.linksSecured++;
  });
  
  // Clean up template variables and placeholder content
  $('*').each((_, element) => {
    if (element.type === 'text') {
      let text = element.data || '';
      let cleaned = false;
      
      // Remove template variables like {$subject}, {{ subject }}, etc.
      if (text.includes('{$') || text.includes('{{')) {
        text = text.replace(/\{\$[^}]+\}/g, '').replace(/\{\{[^}]+\}\}/g, '');
        cleaned = true;
      }
      
      // Remove zero-width characters and other invisible characters
      if (text.includes('\u200B') || text.includes('\u200C') || text.includes('\u200D') || text.includes('\uFEFF')) {
        text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
        cleaned = true;
      }
      
      // Remove excessive whitespace
      if (text.includes('  ') || text.includes('\n\n')) {
        text = text.replace(/\s+/g, ' ').trim();
        cleaned = true;
      }
      
      if (cleaned) {
        element.data = text;
        sanitizationLog.templateVarsCleaned++;
      }
    }
  });
  
  // Set safe base href
  if ($('head base').length === 0) {
    $('head').prepend('<base href="https://api.sender.net/">');
  } else {
    $('head base').attr('href', 'https://api.sender.net/');
  }
  
  logger.debug('📧 Newsletter reader: Sanitization completed:', sanitizationLog);
  
  return $.html();
}

// Main route to view newsletter content
router.get('/:id/view', readerLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug(`📧 Newsletter reader: View request received for campaign ID: ${id}`);
    
    // Check ETag first (browser cache)
    const etag = `"nl-${id}"`;
    if (req.headers['if-none-match'] === etag) {
      logger.debug(`📧 Newsletter reader: Browser cache hit for campaign ID: ${id}`);
      return res.status(304).end();
    }
    
    // Check cache first
    const now = Date.now();
    const cached = HTML_CACHE.get(id);
    if (cached && cached.exp > now) {
      logger.debug(`📧 Newsletter reader: Serving from cache for campaign ID: ${id}`);
      addReaderHeaders(res);
      res.set('ETag', etag);
      res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.type('html').send(cached.body);
    }
    
    // Find campaign
    const campaign = await findCampaign(id);
    if (!campaign) {
      logger.warn(`❌ Newsletter reader: Campaign not found for ID: ${id}`);
      return res.status(404).send('Campaign not found');
    }
    
    // Fetch HTML from Sender API
    logger.debug(`📧 Newsletter reader: Fetching HTML from Sender API for campaign ID: ${id}`);
    const html = await fetchCampaignHtmlFromSender(id);
    
    if (!html) {
      logger.warn(`❌ Newsletter reader: No HTML content found for campaign ID: ${id}`);
      return res.status(404).send('No HTML content available for this campaign');
    }
    
    // Sanitize HTML
    const sanitized = sanitize(html);
    
    // Cache the result
    setWithCap(HTML_CACHE, id, { body: sanitized, exp: now + TTL });
    
    logger.debug(`✅ Newsletter reader: Successfully processed campaign ID: ${id}`);
    
    // Send response
    addReaderHeaders(res);
    res.set('ETag', etag);
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.type('html').send(sanitized);
    
  } catch (error: any) {
    logger.error(`❌ Newsletter reader: Failed to process campaign: ${error?.message}`);
    return res.status(500).send('Failed to load newsletter content');
  }
});

export default router;
