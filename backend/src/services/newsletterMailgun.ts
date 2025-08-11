// src/services/newsletterMailgun.ts
import formData from 'form-data';

let mg: any = null;

async function getMailgunClient() {
  if (!mg) {
    const Mailgun = (await import('mailgun.js')).default;
    mg = new Mailgun(formData).client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY!,
    });
  }
  return mg;
}

const LIST = process.env.MAILING_LIST_ADDRESS!;

export async function mgSubscribe(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Mailgun: Subscribing email:', email);
    console.log('📧 Mailgun: Variables:', vars);
    
    const mgClient = await getMailgunClient();
    const result = await mgClient.lists.members.createMember(LIST, {
      address: email,
      subscribed: 'yes',
      upsert: 'yes',
      vars: JSON.stringify(vars)
    });
    
    console.log('✅ Mailgun: Successfully subscribed:', result);
    return result;
  } catch (error: any) {
    console.error('❌ Mailgun: Failed to subscribe:', error);
    throw error;
  }
}

export async function mgUnsubscribe(email: string) {
  try { 
    const mgClient = await getMailgunClient();
    await mgClient.lists.members.destroyMember(LIST, email); 
  } catch { /* ok if not present */ }
}
