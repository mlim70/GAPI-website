import express from 'express';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { sendContactFormEmail } from '../utils/email/email';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';

const router = express.Router();

// Rate limiting for contact form submissions
const contactFormLimiter = createRateLimiter(5, 15 * 60 * 1000); // 5 submissions per 15 minutes per IP

// Contact form submission endpoint
router.post('/contact', contactFormLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, recaptchaToken } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // reCAPTCHA verification
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'Security verification required. Please refresh the page and try again.'
      });
    }

    console.log('🔍 Verifying reCAPTCHA token for contact form...');
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
    
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
      return res.status(400).json({
        success: false,
        message: 'Security verification failed. Please try again or contact support if the problem persists.'
      });
    }

    // Check if score is acceptable for contact form
    const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'contact_form', RECAPTCHA_CONFIG.THRESHOLDS.CONTACT_FORM);
    if (!isScoreAcceptable) {
      console.log('❌ reCAPTCHA score too low for contact form:', recaptchaResult.score);
      return res.status(400).json({
        success: false,
        message: 'Security verification failed. Please try again or contact support if the problem persists.'
      });
    }

    console.log('✅ reCAPTCHA verification passed for contact form with score:', recaptchaResult.score);

    // Send the email using the template
    await sendContactFormEmail({
      name,
      email,
      subject,
      message,
      date: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon.'
    });

  } catch (error) {
    // Log error for debugging (without sensitive data)
    console.error('Contact form submission failed:', error instanceof Error ? error.message : 'Unknown error');
    
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error sending your message. Please try again or email us directly at info@gapi.org'
    });
  }
});

export default router;
