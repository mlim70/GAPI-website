// dotenv already loaded in main index.ts
import { mailgunEmailService } from '../utils/email/mailgunService';

export async function sendNewsletter(subject: string, html: string) {
  // Check if Mailgun is configured
  if (!mailgunEmailService.isServiceConfigured()) {
    throw new Error('Mailgun not configured - please set MAILGUN_API_KEY and MAILGUN_DOMAIN');
  }

  try {
    // Lazy load environment variables
    const mailingListAddress = process.env.MAILING_LIST_ADDRESS;
    const clientUrl = process.env.CLIENT_URL;
    
    if (!mailingListAddress) {
      throw new Error('MAILING_LIST_ADDRESS environment variable is required');
    }
    
    if (!clientUrl) {
      throw new Error('CLIENT_URL environment variable is required');
    }

    const result = await mailgunEmailService.sendEmail({
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
