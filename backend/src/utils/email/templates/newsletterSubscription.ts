// Email template for newsletter subscription confirmation

export function createNewsletterSubscriptionEmailHTML(confirmUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Newsletter Subscription - GAPI</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
                line-height: 1.6; 
                color: #333;
                background-color: #f9fafb;
            }
            .header { 
                text-align: center; 
                margin-bottom: 30px; 
                padding-bottom: 20px;
                border-bottom: 2px solid #e5e7eb;
            }
            .header h2 {
                color: #10b981;
                margin: 0;
                font-size: 24px;
            }
            .button { 
                background-color: #10b981; 
                color: white; 
                padding: 14px 28px; 
                text-decoration: none; 
                border-radius: 8px; 
                display: inline-block; 
                font-weight: 600; 
                text-align: center; 
                min-width: 220px; 
                box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); 
                transition: all 0.2s ease;
            }
            .button:hover {
                background-color: #059669;
                box-shadow: 0 6px 8px rgba(16, 185, 129, 0.3);
            }
            .footer { 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #e5e7eb; 
                color: #6b7280; 
                font-size: 12px; 
                text-align: center;
            }
            .url { 
                word-break: break-all; 
                color: #6b7280; 
                font-size: 12px; 
                background: #f9fafb; 
                padding: 12px; 
                border-radius: 6px; 
                border: 1px solid #e5e7eb;
                margin: 20px 0;
            }
            .info-box { 
                background-color: #eff6ff; 
                border: 1px solid #3b82f6; 
                padding: 16px; 
                border-radius: 8px; 
                margin: 20px 0;
            }
            .info-box strong {
                color: #1d4ed8;
            }
            .content {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                border: 1px solid #e5e7eb;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #10b981;
                margin-bottom: 10px;
            }
            .button-container {
                text-align: center; 
                margin: 35px 0;
            }
            .newsletter-icon {
                font-size: 48px;
                color: #10b981;
                margin-bottom: 20px;
            }
            .benefits {
                background-color: #f0fdf4;
                border: 1px solid #bbf7d0;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .benefits h3 {
                color: #166534;
                margin-top: 0;
                font-size: 18px;
            }
            .benefits ul {
                margin: 15px 0;
                padding-left: 20px;
            }
            .benefits li {
                margin: 8px 0;
                color: #166534;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">GAPI</div>
            <h2>Stay Connected with GAPI!</h2>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 25px;">
                <div class="newsletter-icon">📧</div>
            </div>
            
            <p>Hi there!</p>
            
            <p>Thank you for subscribing to GAPI newsletters! We're excited to keep you updated with the latest news, events, and announcements from our community.</p>
            
            <div class="benefits">
                <h3>🎯 What you'll receive:</h3>
                <ul>
                    <li>Upcoming event announcements and registration details</li>
                    <li>Latest news and updates from the GAPI community</li>
                    <li>Professional development opportunities and resources</li>
                    <li>Member spotlights and success stories</li>
                </ul>
            </div>
            
            <p>To complete your subscription, please click the button below:</p>
            
            <div class="button-container">
                <a href="${confirmUrl}" class="button">
                    ✅ Confirm Subscription
                </a>
            </div>
            
            <div class="info-box">
                <strong>⏰ Important:</strong>
                <ul>
                    <li>This confirmation link expires in <strong>30 minutes</strong></li>
                    <li>If you didn't request this subscription, you can safely ignore this email</li>
                    <li>You can unsubscribe anytime from your email preferences</li>
                </ul>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="url">${confirmUrl}</div>
            
            <p>We look forward to keeping you informed about all things GAPI! 🎉</p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from GAPI. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} GAPI. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

export function createNewsletterSubscriptionEmailText(confirmUrl: string): string {
  return `
Stay Connected with GAPI!

Hi there!

Thank you for subscribing to GAPI newsletters! We're excited to keep you updated with the latest news, events, and announcements from our community.

🎯 What you'll receive:
- Upcoming event announcements and registration details
- Latest news and updates from the GAPI community
- Professional development opportunities and resources
- Member spotlights and success stories

To complete your subscription, please visit this link:

${confirmUrl}

⏰ IMPORTANT:
- This confirmation link expires in 30 minutes
- If you didn't request this subscription, you can safely ignore this email
- You can unsubscribe anytime from your email preferences

We look forward to keeping you informed about all things GAPI! 🎉

This is an automated message from GAPI. Please do not reply to this email.

© ${new Date().getFullYear()} GAPI. All rights reserved.
  `.trim();
}
