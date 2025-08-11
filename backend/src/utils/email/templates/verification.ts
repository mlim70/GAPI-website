// Email template for email verification

export function createVerificationEmailHTML(name: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - GAPI</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
                line-height: 1.6;
                color: #333;
            }
            .header { 
                text-align: center; 
                margin-bottom: 30px; 
                padding-bottom: 20px;
                border-bottom: 2px solid #e5e7eb;
            }
            .header h2 {
                color: #3b82f6;
                margin: 0;
                font-size: 24px;
            }
            .button { 
                background-color: #3B82F6; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 6px; 
                display: inline-block; 
                font-weight: 600; 
                text-align: center; 
                min-width: 200px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
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
                padding: 10px; 
                border-radius: 4px; 
                border: 1px solid #e5e7eb;
            }
            .warning-box { 
                background-color: #fef3c7; 
                border: 1px solid #f59e0b; 
                padding: 16px; 
                border-radius: 8px; 
                margin: 20px 0; 
            }
            .warning-box strong {
                color: #d97706;
            }
            .warning-box ul {
                margin: 10px 0;
                padding-left: 20px;
            }
            .warning-box li {
                margin: 5px 0;
            }
            .content {
                background-color: #ffffff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            .button-container {
                text-align: center; 
                margin: 30px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">GAPI</div>
            <h2>Welcome to GAPI!</h2>
        </div>
        
        <div class="content">
            <p>Hi ${name},</p>
            
            <p>Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by clicking the button below:</p>
            
            <div class="button-container">
                <a href="${verificationUrl}" class="button">
                    Verify Email Address
                </a>
            </div>
            
            <div class="warning-box">
                <strong>⚠️ Important:</strong>
                <ul>
                    <li>This link will expire in <strong>24 hours</strong></li>
                    <li>If you didn't create this account, you can safely ignore this email</li>
                    <li>For security, this link can only be used once</li>
                </ul>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="url">${verificationUrl}</div>
        </div>
        
        <div class="footer">
            <p>This is an automated message from GAPI. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} GAPI. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

export function createVerificationEmailText(name: string, verificationUrl: string): string {
  return `
Welcome to GAPI!

Hi ${name},

Thank you for registering with GAPI. To complete your registration and proceed to payment, please verify your email address by visiting the link below:

${verificationUrl}

⚠️ IMPORTANT:
- This link will expire in 24 hours
- If you didn't create this account, you can safely ignore this email
- For security, this link can only be used once

This is an automated message from GAPI. Please do not reply to this email.

© ${new Date().getFullYear()} GAPI. All rights reserved.
  `.trim();
}
