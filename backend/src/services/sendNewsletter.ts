// dotenv already loaded in main index.ts
// This service is for managing newsletter subscriptions only
// Actual newsletter sending should be done manually through Sender.net dashboard

export async function sendNewsletter(subject: string, html: string) {
  throw new Error('Newsletter sending is not supported through the webapp. Please use the Sender.net dashboard to send newsletters.');
}
