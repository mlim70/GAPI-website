  // backend/src/routes/newsletterReader.ts
  import { Router } from 'express';
  import * as cheerio from 'cheerio';
  import { getSentCampaignsForList } from '../services/senderCampaigns';
  import { senderAxios } from '../utils/senderAxios';
  import { createRateLimiter } from '../utils/accounts/rateLimiter';
  import { logger } from '../utils/logger';
  import { createCache, CACHE_CONFIG } from '../utils/cache';
  import { sanitizeHtml } from '../utils/sanitizer';

  const router = Router();
  const HTML_CACHE = createCache<string, string>(CACHE_CONFIG.TTL.NEWSLETTER_HTML);

  // Rate limiting removed for better accessibility

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
        "style-src-attr 'unsafe-inline'", // Needed for CSS on elements in modern CSP
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

    // 1) Capture <base href="..."> if present
    let baseHref: string | null = null;
    const baseEl = $('head base[href]').first();
    if (baseEl.length) {
      const href = String(baseEl.attr('href') || '').trim();
      if (href) baseHref = href;
    }

    // Helper: absolutize a possibly-relative URL using baseHref
    const absolutize = (value?: string) => {
      if (!value) return value;
      try {
        // Already absolute (data:, blob:, http(s):) => keep as-is
        if (/^(data:|blob:|https?:)/i.test(value)) return value;
        // No base? leave unchanged
        if (!baseHref) return value;
        return new URL(value, baseHref).toString();
      } catch {
        return value;
      }
    };

    // 2) Rewrite src, href
    $('*[src]').each((_, el) => {
      const $el = $(el);
      const v = $el.attr('src');
      const abs = absolutize(v);
      if (abs && abs !== v) $el.attr('src', abs);
    });

    $('*[href]').each((_, el) => {
      const $el = $(el);
      const v = $el.attr('href');
      const abs = absolutize(v);
      if (abs && abs !== v) $el.attr('href', abs);
    });

    // 3) Rewrite srcset (handle multiple candidates)
    $('img[srcset]').each((_, el) => {
      const $el = $(el);
      const srcset = String($el.attr('srcset') || '');
      const rewritten = srcset
        .split(',')
        .map(part => {
          const [url, descriptor] = part.trim().split(/\s+/, 2);
          const abs = absolutize(url);
          return [abs || url, descriptor].filter(Boolean).join(' ');
        })
        .join(', ');
      $el.attr('srcset', rewritten);
    });

    // === Your existing safety steps (kept) ===

    // Remove all script-related elements
    const scripts = $('script, noscript');
    scripts.remove();

    // Remove event handlers
    $('*').each((_, el) => {
      if (el.type === 'tag' && el.attribs) {
        for (const attr of Object.keys(el.attribs)) {
          if (attr.startsWith('on')) delete el.attribs[attr];
        }
      }
    });

    // Remove dangerous URLs (javascript:, data: in href/src)
    $('*').each((_, el) => {
      if (el.type === 'tag' && el.attribs) {
        for (const attr of Object.keys(el.attribs)) {
          const val = el.attribs[attr];
          if (typeof val === 'string') {
            if ((attr === 'href' || attr === 'src') && /^javascript:/i.test(val)) {
              delete el.attribs[attr];
            }
            // keep data: in src for images; you've allowed it in CSP
          }
        }
      }
    });

    // Remove dangerous elements
    $('object, embed, applet, iframe, form, input, button, select, textarea').remove();

    // Remove dangerous meta tags
    $('meta[http-equiv="refresh"], meta[http-equiv="set-cookie"]').remove();

    // Secure all links
    $('a[href]').attr('target', '_blank').attr('rel', 'noopener noreferrer');

    // Template vars / zero-width chars cleanup (unchanged)
    $('*').contents().each((_, node) => {
      if (node.type === 'text' && node.data) {
        node.data = node.data
          .replace(/\{\$[^}]+\}/g, '')
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
    });

    // 4) Finally, remove <base> so CSP stays tight
    $('head base').remove();

    logger.debug('📧 Newsletter reader: Sanitization completed with base href handling');
    return $.html();
  }

  // Main route to view newsletter content
  router.get('/:id/view', async (req, res) => {
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
      const cached = HTML_CACHE.get(id);
      if (cached) {
        logger.debug(`📧 Newsletter reader: Serving from cache for campaign ID: ${id}`);
        addReaderHeaders(res);
        res.set('ETag', etag);
        res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.type('html').send(cached);
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
      HTML_CACHE.set(id, sanitized);
      
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
