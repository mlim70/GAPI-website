import { Router } from 'express';
import isEmail from 'validator/lib/isEmail.js';
import { createNewsletterToken, verifyNewsletterToken } from '../utils/newsletterTokens';
import { senderSubscribe, senderUnsubscribe, senderGetSubscriber, senderGetCampaigns } from '../services/newsletterSender';
import { getSentCampaignsForList, resolveCampaignOpenTarget } from '../services/senderCampaigns';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { getFrontendUrl } from '../config/urls';
import { normalizeEmail } from '../utils/email/emailUtils';


const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', createRateLimiter(5, 60 * 1000, 'email'), validateRecaptcha({ action: 'newsletter_subscribe' }), async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalized = normalizeEmail(email);
    
    if (!isEmail(normalized)) return res.status(400).json({ message: 'Valid email required' });
    
    // reCAPTCHA validation is now handled by middleware
    const recaptchaResult = res.locals.recaptchaResult;

    // Directly subscribe to mailing list without sending confirmation email
    await senderSubscribe(normalized, {
      source: 'webform',
      consentVersion: '2025-08-11',
    });
    console.log('✅ Successfully subscribed to mailing list:', normalized);

    // Do not reveal whether an address exists — always 204.
    return res.sendStatus(204);
  } catch (err) {
    // Optional: log err
    return res.sendStatus(204); // still no enumeration
  }
});

// GET /api/newsletter/campaigns - Get sent newsletter campaigns for a specific list
router.get('/campaigns', async (req, res) => {
  try {
    const listId = (req.query.listId as string) || undefined;
    const data = await getSentCampaignsForList(listId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Newsletter campaigns error:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to load campaigns' });
  }
});

// --- add: open one campaign ---
// If a public URL exists, redirect there. Otherwise, serve HTML.
router.get('/campaigns/:id/open', async (req, res) => {
  try {
    const { id } = req.params;
    const { url, html } = await resolveCampaignOpenTarget(id);

    if (url) {
      return res.redirect(302, url);
    }
    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
    return res.status(404).send('Campaign not available for viewing.');
  } catch (err: any) {
    console.error('Open campaign error:', err?.message);
    return res.status(500).send('Failed to open campaign.');
  }
});

// GET /api/newsletter/confirm - This endpoint is no longer needed but kept for backward compatibility
router.get('/confirm', async (req, res) => {
  console.log('🔍 Newsletter confirmation request received (legacy endpoint)');
  console.log('   Query params:', req.query);
  
  try {
    const token = String(req.query.token || '');
    console.log('   Token received:', token ? `${token.substring(0, 50)}...` : 'NO TOKEN');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).send('Invalid request');
    }

    console.log('   Attempting to verify token...');
    const email = verifyNewsletterToken(token); // throws on invalid/expired
    console.log('✅ Token verified successfully');
    console.log('   Email from token:', email);

    console.log('   Attempting to subscribe to mailing list...');
    await senderSubscribe(email, {
      source: 'webform',
      consentVersion: '2025-08-11',
    });
    console.log('✅ Successfully subscribed to mailing list');

    const redirectUrl = `${getFrontendUrl()}/newsletter/success`;
    console.log('   Redirecting to:', redirectUrl);
    return res.redirect(redirectUrl);
    
  } catch (error: any) {
    console.error('❌ Newsletter confirmation failed:', error.message);
    console.error('   Error type:', error.constructor.name);
    console.error('   Full error:', error);
    
    if (error.name === 'TokenExpiredError') {
      console.log('   Token has expired');
      return res.status(400).send('Link has expired. Please subscribe again.');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('   Invalid JWT token');
      return res.status(400).send('Invalid link. Please subscribe again.');
    } else {
      console.log('   Unknown error type');
      return res.status(400).send('Invalid or expired link');
    }
  }
});

// Secure unsubscribe request - direct unsubscribe without confirmation email
router.post('/unsubscribe', createRateLimiter(4, 60 * 1000, 'email'), async (req, res) => {
  try {
    const { email, recaptchaToken } = req.body || {};
    const normalized = normalizeEmail(email);
    
    if (!isEmail(normalized)) {
      return res.status(400).json({ message: 'Valid email required' });
    }
    
    // reCAPTCHA verification for newsletter unsubscription (optional for better UX)
    if (recaptchaToken) {
      console.log('🔍 Verifying reCAPTCHA token for newsletter unsubscription...');
      const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
      
      if (!recaptchaResult.success) {
        console.log('❌ reCAPTCHA verification failed for newsletter unsubscription:', recaptchaResult.error);
        return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
      }

      // Check if score is acceptable for newsletter unsubscription
      const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'newsletter_unsubscribe', 0.4);
      if (!isScoreAcceptable) {
        console.log('❌ reCAPTCHA score too low for newsletter unsubscription:', recaptchaResult.score);
        return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
      }

      console.log('✅ reCAPTCHA verification passed for newsletter unsubscription with score:', recaptchaResult.score);
    } else {
      console.log('ℹ️ No reCAPTCHA token provided for newsletter unsubscription (optional)');
    }

    console.log('🔍 Unsubscribe request received for:', normalized);
    
    // Directly unsubscribe from mailing list without sending confirmation email
    await senderUnsubscribe(normalized);
    console.log('✅ Successfully unsubscribed from mailing list:', normalized);
    
    return res.json({ message: 'Successfully unsubscribed from newsletter' });
    
  } catch (error: any) {
    console.error('❌ Failed to unsubscribe:', error.message);
    return res.status(500).json({ message: 'Failed to unsubscribe from newsletter' });
  }
});

export default router;
