import { Router } from 'express';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { sendContactFormEmail } from '../utils/email/email';
import { validateRecaptcha } from '../middleware/recaptchaValidation';

const router = Router();

// Rate limiting for contact form submissions
const contactFormLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10 submissions per 15 minutes per IP

// Contact form submission endpoint
router.post('/', contactFormLimiter, validateRecaptcha({ action: 'contact_form' }), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
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
