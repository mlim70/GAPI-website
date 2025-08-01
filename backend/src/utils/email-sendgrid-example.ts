// Example: How to switch to SendGrid (minimal changes)
import 'dotenv/config'
import axios from 'axios';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

// Same test tokens storage
export const testTokens: Array<{ email: string; token: string; userId: string }> = [];

// SendGrid doesn't need template caching like Sender.net
// We can send HTML directly or use dynamic templates

export async function sendVerificationEmail({
  email,
  name,
  token,
  userId,
}: {
  email: string;
  name: string;
  token: string;
  userId: string;
}) {
  console.log(`📧 sendVerificationEmail called for ${email} with userId: ${userId}`);
  
  // Check if SENDGRID_API_KEY is configured
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY not configured, skipping email send for testing');
    console.log(`📧 Would send verification email to ${email} with token: ${token}`);
    
    // Store token for testing purposes
    testTokens.push({ email, token, userId });
    return;
  }
  
  // Store token for testing purposes
  testTokens.push({ email, token, userId });

  // Same URL generation logic
  const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://gapi-website.vercel.app';
  const verificationUrl = `${baseUrl}/email-verification?token=${token}&pendingUserId=${userId}`;

  // Same HTML template (just moved inline for SendGrid)
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to GAPI!</h2>
      <p>Hi ${name},</p>
      <p>Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by clicking the link below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      
      <p><strong>Important:</strong></p>
      <ul>
        <li>This link will expire in 24 hours</li>
        <li>If you didn't create this account, you can safely ignore this email</li>
        <li>For security, this link can only be used once</li>
      </ul>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationUrl}</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">
        This is an automated message from GAPI. Please do not reply to this email.
      </p>
    </div>
  `;

  try {
    // SendGrid API call (different structure, same concept)
    const response = await axios.post(
      `${SENDGRID_BASE}/mail/send`,
      {
        personalizations: [
          {
            to: [{ email: email, name: name }],
            subject: 'Please verify your e-mail address'
          }
        ],
        from: { email: 'info@gapi.org', name: 'GAPI' },
        reply_to: { email: 'info@gapi.org', name: 'GAPI' },
        content: [
          {
            type: 'text/html',
            value: htmlContent
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Verification email sent to ${email}`);
    console.log(`📧 SendGrid Message ID: ${response.headers['x-message-id']}`);
    
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error.response?.data || error.message);
    // Don't throw the error, just log it so the registration can still proceed
  }
} 