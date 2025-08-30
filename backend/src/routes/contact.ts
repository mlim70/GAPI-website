import express, { Router } from 'express';
import { sendContactFormEmail } from '../utils/email/email';
import { validateContactForm } from '../utils/email/emailUtils';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { logger } from '../utils/general/logger';

const router = Router();

// Rate limiting for contact form submissions
const contactFormLimiter = createRateLimiter(8, 15 * 60 * 1000); // 8 requests per 15 minutes

/**
 * Submit contact form
 */
router.post('/', contactFormLimiter, validateRecaptcha({ action: 'contact_form' }), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    const validation = validateContactForm({ name, email, subject, message });
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Send contact form email
    await sendContactFormEmail({
      name,
      email,
      subject,
      message,
      date: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.'
    });

  } catch (error) {
    logger.error('Contact form submission failed:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Failed to send message. Please try again later.'
    });
  }
});

export default router;
