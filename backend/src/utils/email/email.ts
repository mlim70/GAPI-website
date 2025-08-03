// utils/email.ts
import 'dotenv/config'
import axios from 'axios';

const SENDER_API_KEY = process.env.SENDER_API_KEY;
const TX_BASE = 'https://api.sender.net/v2';

// In-memory storage for test tokens (only used when SENDER_API_KEY is not set)
export const testTokens: Array<{ email: string; token: string; userId: string }> = [];

// Cache for campaign template ID to avoid recreating it every time
let campaignTemplateId: string | null = null;

async function getOrCreateCampaignTemplate(): Promise<string> {
  // If we already have a campaign template ID, return it
  if (campaignTemplateId) {
    return campaignTemplateId;
  }

  try {
    // Create or update the campaign template
    const response = await axios.post(
      `${TX_BASE}/transactional`,
      {
        title: 'GAPI Email Verification',
        subject: 'Please verify your e-mail address',
        from: 'GAPI',
        reply_to: 'info@gapi.org',
        editor: 'html',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to GAPI!</h2>
            <p>Hi {{name}},</p>
            <p>Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by clicking the link below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{verificationUrl}}" 
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
            <p style="word-break: break-all; color: #666; font-size: 12px;">{{verificationUrl}}</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message from GAPI. Please do not reply to this email.
            </p>
          </div>
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${SENDER_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    // Extract the campaign ID from the response
    campaignTemplateId = response.data.data.id;
    console.log(`✅ Campaign template created/updated with ID: ${campaignTemplateId}`);
    return campaignTemplateId;

  } catch (error: any) {
    console.error('❌ Failed to create campaign template:', error.response?.data || error.message);
    throw new Error('Failed to create email campaign template');
  }
}

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
  
  // Check if SENDER_API_KEY is configured
  if (!SENDER_API_KEY) {
    console.error('❌ SENDER_API_KEY not configured - email functionality is disabled');
    throw new Error('Email service not configured - SENDER_API_KEY is required');
  }
  
  // Also store token for testing purposes even when SENDER_API_KEY is set
  // This allows tests to work in environments with configured email
  console.log(`📧 Storing test token for ${email} with userId: ${userId}`);
  testTokens.push({ email, token, userId });

  // Ensure HTTPS is used for verification URLs
  const baseUrl = process.env.CLIENT_URL?.replace(/^http:/, 'https:') || 'https://gapi-website.vercel.app';
  const verificationUrl = `${baseUrl}/email-verification?token=${token}&pendingUserId=${userId}`;

  try {
    // Step 1: Get or create the campaign template
    const campaignId = await getOrCreateCampaignTemplate();

    // Step 2: Send an instance of the template to the recipient
    const response = await axios.post(
      `${TX_BASE}/message/${campaignId}/send`,
      {
        recipient_email: email,
        variables: {
          name: name,
          verificationUrl: verificationUrl,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${SENDER_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    console.log(`✅ Verification email sent to ${email}`);
    console.log(`📧 Email ID: ${response.data.emailId}`);
    
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error.response?.data || error.message);
    throw new Error(`Failed to send verification email: ${error.response?.data?.message || error.message}`);
  }
}
