import express from 'express';

const router = express.Router();

// Test endpoint to send a test email
router.post('/test-email', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.MAILGUN_API_KEY) {
      return res.status(500).json({ 
        error: 'MAILGUN_API_KEY not configured in environment variables' 
      });
    }

    // Check if domain is configured
    if (!process.env.MAILGUN_DOMAIN) {
      return res.status(500).json({ 
        error: 'MAILGUN_DOMAIN not configured in environment variables' 
      });
    }

    // Dynamic imports for ES modules
    const formData = (await import('form-data')).default;
    const Mailgun = (await import('mailgun.js')).default;

    // Initialize Mailgun client
    const mg = new Mailgun(formData).client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY!,
    });

    const { to, subject = 'Test email from GAPI', text = 'This is a test email from GAPI.' } = req.body;

    if (!to) {
      return res.status(400).json({ 
        error: 'Recipient email address is required' 
      });
    }

    // Send test email
    const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `GAPI <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: to,
      subject: subject,
      text: text,
    });

    console.log('✅ Test email sent successfully:', result);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: result.id,
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to send test email:', error);
    
    // Provide helpful error information
    let errorMessage = 'Failed to send test email';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    if (error.status) {
      errorMessage += ` (Status: ${error.status})`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message || 'Unknown error occurred'
    });
  }
});

// Test transactional email endpoints
router.post('/test-verification-email', async (req, res) => {
  try {
    const { to, name = 'Test User', userId = 'test-user-123' } = req.body;

    if (!to) {
      return res.status(400).json({ 
        error: 'Recipient email address is required' 
      });
    }

    // Dynamic import for the email service
    const { sendVerificationEmail } = await import('../utils/email/email.js');
    
    const result = await sendVerificationEmail({
      email: to,
      name,
      userId,
      token: 'test-token-123', // Mock token for testing
    });

    res.json({ 
      success: true, 
      message: 'Verification email sent successfully',
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error);
    res.status(500).json({ 
      error: 'Failed to send verification email',
      details: error.message || 'Unknown error occurred'
    });
  }
});

router.post('/test-welcome-email', async (req, res) => {
  try {
    const { to, name = 'Test User' } = req.body;

    if (!to) {
      return res.status(400).json({ 
        error: 'Recipient email address is required' 
      });
    }

    // Dynamic import for the email service
    const { sendWelcomeEmail } = await import('../utils/email/email.js');
    
    const result = await sendWelcomeEmail(to, name);

    res.json({ 
      success: true, 
      message: 'Welcome email sent successfully',
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error);
    res.status(500).json({ 
      error: 'Failed to send welcome email',
      details: error.message || 'Unknown error occurred'
    });
  }
});

router.post('/test-password-reset-email', async (req, res) => {
  try {
    const { to, name = 'Test User', userId = 'test-user-123' } = req.body;

    if (!to) {
      return res.status(400).json({ 
        error: 'Recipient email address is required' 
      });
    }

    // Dynamic import for the email service
    const { sendPasswordResetEmail } = await import('../utils/email/email.js');
    
    const result = await sendPasswordResetEmail(to, name, userId);

    res.json({ 
      success: true, 
      message: 'Password reset email sent successfully',
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error);
    res.status(500).json({ 
      error: 'Failed to send password reset email',
      details: error.message || 'Unknown error occurred'
    });
  }
});

router.post('/test-custom-email', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to) {
      return res.status(400).json({ 
        error: 'Recipient email address is required' 
      });
    }

    if (!text && !html) {
      return res.status(400).json({ 
        error: 'Either text or HTML content is required' 
      });
    }

    // Dynamic import for the email service
    const { sendCustomEmail } = await import('../utils/email/email.js');
    
    const result = await sendCustomEmail({
      to,
      subject: subject || 'Custom email from GAPI',
      text,
      html,
    });

    res.json({ 
      success: true, 
      message: 'Custom email sent successfully',
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to send custom email:', error);
    res.status(500).json({ 
      error: 'Failed to send custom email',
      details: error.message || 'Unknown error occurred'
    });
  }
});

// Get Mailgun configuration status
router.get('/status', (req, res) => {
  const config = {
    apiKeyConfigured: !!process.env.MAILGUN_API_KEY,
    domainConfigured: !!process.env.MAILGUN_DOMAIN,
    domain: process.env.MAILGUN_DOMAIN || 'Not configured',
    apiKeyLength: process.env.MAILGUN_API_KEY ? process.env.MAILGUN_API_KEY.length : 0
  };
  
  res.json(config);
});

// Get email service status
router.get('/email-service-status', async (req, res) => {
  try {
    // Dynamic import for the email service
    const { getEmailServiceStatus } = await import('../utils/email/email.js');
    const status = getEmailServiceStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get email service status',
      details: error.message || 'Unknown error occurred'
    });
  }
});

export default router;
