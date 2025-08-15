// dotenv already loaded in main index.ts
import { senderEmailService } from '../utils/email/senderService';
import { SENDER_LIST_ID, CLIENT_URL } from '../config/env';

export async function sendNewsletter(subject: string, html: string) {
  // Check if Sender.net is configured
  if (!senderEmailService.isServiceConfigured()) {
    throw new Error('Sender.net not configured - please set SENDER_API_KEY and SENDER_DOMAIN');
  }

  try {
    // Use environment variables from config
    const mailingListAddress = SENDER_LIST_ID;
    const clientUrl = CLIENT_URL;

    // Add newsletter-specific headers to the HTML content
    const newsletterHtml = `
      ${html}
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
        <p>To unsubscribe, <a href="mailto:unsubscribe@gapi.org?subject=unsubscribe">click here</a> or visit <a href="${clientUrl}/newsletter/preferences">our preferences page</a>.</p>
      </div>
    `;

    const result = await senderEmailService.sendNewsletter(subject, newsletterHtml, mailingListAddress);

    console.log(`✅ Newsletter sent successfully to ${mailingListAddress}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send newsletter:', error.message);
    throw new Error(`Failed to send newsletter: ${error.message}`);
  }
}
