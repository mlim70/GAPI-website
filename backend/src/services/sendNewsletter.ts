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

    const result = await senderEmailService.sendEmail({
      to: mailingListAddress,
      from: `GAPI Newsletter <${mailingListAddress}>`,
      subject,
      html,
      headers: {
        'h:Reply-To': 'info@gapi.org',
        'List-Unsubscribe': `<mailto:unsubscribe@gapi.org?subject=unsubscribe>, <${clientUrl}/newsletter/preferences>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    console.log(`✅ Newsletter sent successfully to ${mailingListAddress}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send newsletter:', error.message);
    throw new Error(`Failed to send newsletter: ${error.message}`);
  }
}
