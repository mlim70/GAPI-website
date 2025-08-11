import { Router } from 'express';
import isEmail from 'validator/lib/isEmail.js';
import { createNewsletterToken, verifyNewsletterToken, createUnsubscribeToken, verifyUnsubscribeToken } from '../utils/newsletterTokens';
import { mgSubscribe, mgUnsubscribe } from '../services/newsletterMailgun';
import { sendCustomEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { createNewsletterSubscriptionEmailHTML, createNewsletterSubscriptionEmailText } from '../utils/email/templates/newsletterSubscription';
import { createNewsletterUnsubscriptionEmailHTML, createNewsletterUnsubscriptionEmailText } from '../utils/email/templates/newsletterUnsubscription';

const router = Router();
const API_ORIGIN = process.env.SERVER_URL ?? process.env.API_URL ?? ''; // e.g. https://api.gapi.org
const CLIENT_URL = process.env.CLIENT_URL!;

// POST /api/newsletter/subscribe
router.post('/subscribe', createRateLimiter(5, 60 * 1000, 'email'), async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!isEmail(normalized)) return res.status(400).json({ message: 'Valid email required' });

    const token = createNewsletterToken(normalized, 30);
    const confirmUrl = `${process.env.VITE_API_URL}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;

    await sendCustomEmail({
      to: normalized,
      subject: 'Confirm your subscription',
      html: createNewsletterSubscriptionEmailHTML(confirmUrl),
      text: createNewsletterSubscriptionEmailText(confirmUrl),
    });

    // Do not reveal whether an address exists — always 204.
    return res.sendStatus(204);
  } catch (err) {
    // Optional: log err
    return res.sendStatus(204); // still no enumeration
  }
});

// GET /api/newsletter/confirm
router.get('/confirm', async (req, res) => {
  console.log('🔍 Newsletter confirmation request received');
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
    await mgSubscribe(email, {
      source: 'webform',
      consentVersion: '2025-08-11',
    });
    console.log('✅ Successfully subscribed to mailing list');

    const redirectUrl = `${CLIENT_URL}/newsletter/success`;
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

// Secure unsubscribe request - sends confirmation email
router.post('/unsubscribe', createRateLimiter(4, 60 * 1000, 'email'), async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    
    if (!isEmail(normalized)) {
      return res.status(400).json({ message: 'Valid email required' });
    }

    console.log('🔍 Unsubscribe request received for:', normalized);
    
    // Generate unsubscribe token
    const token = createUnsubscribeToken(normalized, 60);
    const confirmUrl = `${process.env.VITE_API_URL}/api/newsletter/unsubscribe/confirm?token=${encodeURIComponent(token)}`;
    
    // Send confirmation email
    await sendCustomEmail({
      to: normalized,
      subject: 'Confirm Unsubscribe from GAPI Newsletter',
      html: createNewsletterUnsubscriptionEmailHTML(confirmUrl),
      text: createNewsletterUnsubscriptionEmailText(confirmUrl),
    });

    console.log('✅ Unsubscribe confirmation email sent to:', normalized);
    return res.json({ message: 'Unsubscribe confirmation sent to your email' });
    
  } catch (error: any) {
    console.error('❌ Failed to send unsubscribe confirmation:', error.message);
    return res.status(500).json({ message: 'Failed to send unsubscribe confirmation' });
  }
});

// Confirm unsubscribe with token
router.get('/unsubscribe/confirm', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) {
      return res.status(400).send('Invalid request');
    }

    console.log('🔍 Unsubscribe confirmation request received');
    console.log('   Token received:', token ? `${token.substring(0, 50)}...` : 'NO TOKEN');

    // Verify token
    const email = verifyUnsubscribeToken(token);
    console.log('✅ Unsubscribe token verified successfully');
    console.log('   Email from token:', email);

    // Unsubscribe from mailing list
    await mgUnsubscribe(email);
    console.log('✅ Successfully unsubscribed from mailing list');

    // Redirect to success page
    const redirectUrl = `${CLIENT_URL}/newsletter/unsubscribed`;
    console.log('   Redirecting to:', redirectUrl);
    return res.redirect(redirectUrl);
    
  } catch (error: any) {
    console.error('❌ Unsubscribe confirmation failed:', error.message);
    return res.status(400).send('Invalid or expired unsubscribe link');
  }
});

export default router;
