// dotenv already loaded in main index.ts
// src/services/newsletterMailgun.ts
import formData from 'form-data';

let mg: any = null;

// Lazy loading function for the API key
function getMailgunApiKey(): string {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY environment variable is required');
  }
  return apiKey;
}

// Lazy loading function for the mailing list address
function getMailingListAddress(): string {
  const address = process.env.MAILING_LIST_ADDRESS;
  if (!address) {
    throw new Error('MAILING_LIST_ADDRESS environment variable is required');
  }
  return address;
}

async function getMailgunClient() {
  if (!mg) {
    const Mailgun = (await import('mailgun.js')).default;
    mg = new Mailgun(formData).client({
      username: 'api',
      key: getMailgunApiKey(),
    });
  }
  return mg;
}

export async function mgSubscribe(email: string, vars: Record<string, any> = {}) {
  try {
    console.log('📧 Mailgun: Subscribing email:', email);
    console.log('📧 Mailgun: Variables:', vars);
    
    const mgClient = await getMailgunClient();
    const listAddress = getMailingListAddress();
    const result = await mgClient.lists.members.createMember(listAddress, {
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
    const listAddress = getMailingListAddress();
    await mgClient.lists.members.destroyMember(listAddress, email); 
  } catch { /* ok if not present */ }
}
