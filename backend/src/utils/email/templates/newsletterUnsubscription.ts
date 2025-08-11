// Email template for newsletter unsubscription confirmation

export function createNewsletterUnsubscriptionEmailHTML(confirmUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Newsletter Unsubscription - GAPI</title>
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
                color: #ef4444;
                margin: 0;
                font-size: 24px;
            }
            .button { 
                background-color: #ef4444; 
                color: white; 
                padding: 14px 28px; 
                text-decoration: none; 
                border-radius: 8px; 
                display: inline-block; 
                font-weight: 600; 
                text-align: center; 
                min-width: 220px; 
                box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2); 
                transition: all 0.2s ease;
            }
            .button:hover {
                background-color: #dc2626;
                box-shadow: 0 6px 8px rgba(239, 68, 68, 0.3);
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
            .warning-box { 
                background-color: #fef2f2; 
                border: 1px solid #fecaca; 
                padding: 16px; 
                border-radius: 8px; 
                margin: 20px 0;
            }
            .warning-box strong {
                color: #dc2626;
            }
            .warning-box ul {
                margin: 15px 0;
                padding-left: 20px;
            }
            .warning-box li {
                margin: 8px 0;
                color: #dc2626;
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
                color: #ef4444;
                margin-bottom: 10px;
            }
            .button-container {
                text-align: center; 
                margin: 35px 0;
            }
            .unsubscribe-icon {
                font-size: 48px;
                color: #ef4444;
                margin-bottom: 20px;
            }
            .info-box {
                background-color: #f0f9ff;
                border: 1px solid #7dd3fc;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .info-box h3 {
                color: #0369a1;
                margin-top: 0;
                font-size: 18px;
            }
            .info-box ul {
                margin: 15px 0;
                padding-left: 20px;
            }
            .info-box li {
                margin: 8px 0;
                color: #0369a1;
            }
            .resubscribe {
                background-color: #f0fdf4;
                border: 1px solid #bbf7d0;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
                text-align: center;
            }
            .resubscribe h3 {
                color: #166534;
                margin-top: 0;
                font-size: 18px;
            }
            .resubscribe p {
                color: #166534;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">GAPI</div>
            <h2>Newsletter Unsubscription Request</h2>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 25px;">
                <div class="unsubscribe-icon">📧</div>
            </div>
            
            <p>Hi there!</p>
            
            <p>We received a request to unsubscribe your email address from GAPI newsletters. We're sorry to see you go, but we respect your decision.</p>
            
            <div class="warning-box">
                <strong>⚠️ Please confirm your request:</strong>
                <ul>
                    <li>Click the button below to confirm your unsubscription</li>
                    <li>This action will remove you from our mailing list</li>
                    <li>You will no longer receive GAPI updates and announcements</li>
                </ul>
            </div>
            
            <p>To confirm your unsubscription, please click the button below:</p>
            
            <div class="button-container">
                <a href="${confirmUrl}" class="button">
                    🚫 Confirm Unsubscription
                </a>
            </div>
            
            <div class="info-box">
                <strong>⏰ Important:</strong>
                <ul>
                    <li>This confirmation link expires in <strong>1 hour</strong></li>
                    <li>If you didn't request this unsubscription, you can safely ignore this email</li>
                    <li>Your subscription will remain active until you confirm</li>
                </ul>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="url">${confirmUrl}</div>
            
            <div class="resubscribe">
                <h3>💡 Changed your mind?</h3>
                <p>You can always resubscribe to our newsletters anytime by visiting our website!</p>
            </div>
            
            <p>Thank you for being part of the GAPI community. We hope to see you again soon!</p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from GAPI. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} GAPI. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

export function createNewsletterUnsubscriptionEmailText(confirmUrl: string): string {
  return `
Newsletter Unsubscription Request - GAPI

Hi there!

We received a request to unsubscribe your email address from GAPI newsletters. We're sorry to see you go, but we respect your decision.

⚠️ Please confirm your request:
- Click the link below to confirm your unsubscription
- This action will remove you from our mailing list
- You will no longer receive GAPI updates and announcements

To confirm your unsubscription, please visit this link:

${confirmUrl}

⏰ IMPORTANT:
- This confirmation link expires in 1 hour
- If you didn't request this unsubscription, you can safely ignore this email
- Your subscription will remain active until you confirm

💡 Changed your mind?
You can always resubscribe to our newsletters anytime by visiting our website!

Thank you for being part of the GAPI community. We hope to see you again soon!

This is an automated message from GAPI. Please do not reply to this email.

© ${new Date().getFullYear()} GAPI. All rights reserved.
  `.trim();
}
