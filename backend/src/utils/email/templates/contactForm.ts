interface ContactFormContext {
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  userAgent: string;
}

export function generateContactFormEmail(context: ContactFormContext): { subject: string; html: string; text: string } {
  const { name, email, subject, message, timestamp, userAgent } = context;
  
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Form Submission - GAPI</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #374151; margin-bottom: 5px; }
        .value { background-color: white; padding: 10px; border-radius: 4px; border-left: 4px solid #dc2626; }
        .message-box { background-color: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Contact Form Submission</h1>
          <p>GAPI Website Contact Form</p>
        </div>
        
        <div class="content">
          <div class="field">
            <div class="label">From:</div>
            <div class="value">${name} (${email})</div>
          </div>
          
          <div class="field">
            <div class="label">Subject:</div>
            <div class="value">${subject}</div>
          </div>
          
          <div class="field">
            <div class="label">Message:</div>
            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
          </div>
          
          <div class="field">
            <div class="label">Submitted:</div>
            <div class="value">${formattedDate}</div>
          </div>
          
          <div class="field">
            <div class="label">User Agent:</div>
            <div class="value">${userAgent}</div>
          </div>
          
          <div class="footer">
            <p>This message was sent from the GAPI website contact form.</p>
            <p>To respond, please reply directly to: ${email}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Contact Form Submission - GAPI Website

From: ${name} (${email})
Subject: ${subject}
Submitted: ${formattedDate}

Message:
${message}

---
This message was sent from the GAPI website contact form.
To respond, please reply directly to: ${email}
  `;

  return {
    subject: `Contact Form: ${subject}`,
    html,
    text
  };
}
