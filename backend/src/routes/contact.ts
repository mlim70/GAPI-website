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

    console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);

    // Generate email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Contact Form Submission - GAPI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #374151; margin-bottom: 5px; }
          .value { background-color: white; padding: 10px; border-radius: 4px; border-left: 4px solid #dc2626; }
          .message-box { background-color: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Contact Form Submission</h1>
            <p>GAPI Website Contact Form</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">From:</div>
              <div class="value">${name} (${email})</div>
            </div>
            <div class="field">
              <div class="label">Subject:</div>
              <div class="value">${subject}</div>
            </div>
            <div class="field">
              <div class="label">Message:</div>
              <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="field">
              <div class="label">Submitted:</div>
              <div class="value">${new Date().toLocaleString('en-US')}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Contact Form Submission - GAPI Website

From: ${name} (${email})
Subject: ${subject}
Submitted: ${new Date().toLocaleString('en-US')}

Message:
${message}

---
This message was sent from the GAPI website contact form.
To respond, please reply directly to: ${email}
    `;

    // Send the email
    await sendContactFormEmail({
      name,
      email,
      subject,
      message
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
