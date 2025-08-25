import { Router } from 'express';
import isEmail from 'validator/lib/isEmail.js';
import { senderSubscribe, senderUnsubscribe } from '../services/newsletterSender';
import { getSentCampaignsForList, getEnrichedCampaignsForList } from '../services/senderCampaigns';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { normalizeEmail } from '../utils/email/emailUtils';
import { addSecurityHeaders } from '../utils/accounts/security';
import { logger } from '../utils/logger';

const router = Router();
router.use(addSecurityHeaders);

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
    logger.info('✅ Successfully subscribed to mailing list:', normalized);

    // Do not reveal whether an address exists — always 204.
    return res.sendStatus(204);
  } catch (err) {
    logger.error('❌ Newsletter subscribe error:', err);
    return res.sendStatus(204);
  }
});

// GET /api/newsletter/campaigns - Get sent newsletter campaigns for a specific list
router.get('/campaigns', createRateLimiter(30, 60_000), async (req, res) => {
  try {
    const listId = (req.query.listId as string) || undefined;
    const enriched = String(req.query.enriched || '').toLowerCase() === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // Max 50 per page
    
    const data = enriched
      ? await getEnrichedCampaignsForList(listId, page, limit)
      : await getSentCampaignsForList(listId, page, limit);
    
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error('Newsletter campaigns error:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to load campaigns' });
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
      logger.info('🔍 Verifying reCAPTCHA token for newsletter unsubscription...');
      const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
      
      if (!recaptchaResult.success) {
        logger.warn('❌ reCAPTCHA verification failed for newsletter unsubscription:', recaptchaResult.error);
        return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
      }

      // Check if score is acceptable for newsletter unsubscription
      const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'newsletter_unsubscribe', 0.4);
      if (!isScoreAcceptable) {
        logger.warn('❌ reCAPTCHA score too low for newsletter unsubscription:', recaptchaResult.score);
        return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
      }

      logger.info('✅ reCAPTCHA verification passed for newsletter unsubscription with score:', recaptchaResult.score);
    } else {
      logger.info('ℹ️ No reCAPTCHA token provided for newsletter unsubscription (optional)');
    }

    logger.info('🔍 Unsubscribe request received for:', normalized);
    
    // Directly unsubscribe from mailing list without sending confirmation email
    await senderUnsubscribe(normalized);
    logger.info('✅ Successfully unsubscribed from mailing list:', normalized);
    
    return res.json({ message: 'Successfully unsubscribed from newsletter' });
    
  } catch (error: any) {
    logger.error('❌ Failed to unsubscribe:', error.message);
    return res.status(500).json({ message: 'Failed to unsubscribe from newsletter' });
  }
});

export default router;
