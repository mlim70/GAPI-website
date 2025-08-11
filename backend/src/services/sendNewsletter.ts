import { mailgunEmailService } from '../utils/email/mailgunService';

export async function sendNewsletter(subject: string, html: string) {
  // Check if Mailgun is configured
  if (!mailgunEmailService.isServiceConfigured()) {
    throw new Error('Mailgun not configured - please set MAILGUN_API_KEY and MAILGUN_DOMAIN');
  }

  try {
    const result = await mailgunEmailService.sendEmail({
      to: process.env.MAILING_LIST_ADDRESS!,
      from: `GAPI Newsletter <${process.env.MAILING_LIST_ADDRESS}>`,
      subject,
      html,
      headers: {
        'h:Reply-To': 'info@gapi.org',
        'List-Unsubscribe': `<mailto:unsubscribe@gapi.org?subject=unsubscribe>, <${process.env.CLIENT_URL}/newsletter/preferences>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    console.log(`✅ Newsletter sent successfully to ${process.env.MAILING_LIST_ADDRESS}`);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to send newsletter:', error.message);
    throw new Error(`Failed to send newsletter: ${error.message}`);
  }
}
