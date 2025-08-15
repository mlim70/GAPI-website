// dotenv already loaded in main index.ts
import express from 'express';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { senderEmailService } from '../utils/email/senderService';
import { createNewsletterToken, verifyNewsletterToken } from '../utils/newsletterTokens';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../utils/newsletterTokens';
import { senderSubscribe, senderUnsubscribe } from '../services/newsletterSender';
import isEmail from 'validator/lib/isEmail.js';
import { getFrontendUrl } from '../config/urls';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';


const router = express.Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', createRateLimiter(5, 60 * 1000, 'email'), async (req, res) => {
  try {
    const { email, recaptchaToken } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    
    if (!isEmail(normalized)) return res.status(400).json({ message: 'Valid email required' });
    
    // reCAPTCHA verification for newsletter subscription
    if (!recaptchaToken) {
      console.log('❌ Missing reCAPTCHA token for newsletter subscription');
      return res.status(400).json({ message: 'Security verification required. Please refresh the page and try again.' });
    }

    console.log('🔍 Verifying reCAPTCHA token for newsletter subscription...');
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
    
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA verification failed for newsletter subscription:', recaptchaResult.error);
      return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
    }

    // Check if score is acceptable for newsletter subscription
    const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'newsletter_subscribe', RECAPTCHA_CONFIG.THRESHOLDS.NEWSLETTER_SUBSCRIBE);
    if (!isScoreAcceptable) {
      console.log('❌ reCAPTCHA score too low for newsletter subscription:', recaptchaResult.score);
      return res.status(400).json({ message: 'Security verification failed. Please try again or contact support if the problem persists.' });
    }

    console.log('✅ reCAPTCHA verification passed for newsletter subscription with score:', recaptchaResult.score);

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
    const normalized = String(email || '').trim().toLowerCase();
    
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

// Confirm unsubscribe with token - This endpoint is no longer needed but kept for backward compatibility
router.get('/unsubscribe/confirm', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) {
      return res.status(400).send('Invalid request');
    }

    console.log('🔍 Unsubscribe confirmation request received (legacy endpoint)');
    console.log('   Token received:', token ? `${token.substring(0, 50)}...` : 'NO TOKEN');

    // Verify token
    const email = verifyUnsubscribeToken(token);
    console.log('✅ Unsubscribe token verified successfully');
    console.log('   Email from token:', email);

    // Unsubscribe from mailing list
    await senderUnsubscribe(email);
    console.log('✅ Successfully unsubscribed from mailing list');

    // Redirect to success page
    const redirectUrl = `${getFrontendUrl()}/newsletter/unsubscribed`;
    console.log('   Redirecting to:', redirectUrl);
    return res.redirect(redirectUrl);
    
  } catch (error: any) {
    console.error('❌ Unsubscribe confirmation failed:', error.message);
    return res.status(400).send('Invalid or expired unsubscribe link');
  }
});

export default router;
