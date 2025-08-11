import express from 'express';
import { sendCustomEmail } from '../utils/email/email.js';

const router = express.Router();

// Contact form submission endpoint
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

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
    await sendCustomEmail({
      to: 'info@gapi.org',
      from: 'noreply@gapi.org', // Add a proper from address
      subject: `Contact Form: ${subject}`,
      html: htmlContent,
      text: textContent
    });

    // Log the contact form submission (without sensitive data)
    console.log(`Contact form submitted from ${email} regarding: ${subject}`);

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon.'
    });

  } catch (error) {
    console.error('Error sending contact form email:', error);
    
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error sending your message. Please try again or email us directly at info@gapi.org'
    });
  }
});

export default router;
