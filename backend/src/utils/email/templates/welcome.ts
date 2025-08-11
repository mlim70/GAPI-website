// Email template for welcome email after verification

export function createWelcomeEmailHTML(name: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to GAPI!</title>
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
                color: #10b981;
                margin: 0;
                font-size: 24px;
            }
            .footer { 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #e5e7eb; 
                color: #6b7280; 
                font-size: 12px; 
                text-align: center;
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
                color: #10b981;
                margin-bottom: 10px;
            }
            .success-icon {
                font-size: 48px;
                color: #10b981;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">GAPI</div>
            <h2>Welcome to GAPI!</h2>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="success-icon">✅</div>
            </div>
            
            <p>Hi ${name},</p>
            
            <p>Your email has been successfully verified! You can now complete your membership registration and payment.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Welcome to the GAPI community! 🎉</p>
        </div>
        
        <div class="footer">
            <p>Thank you for choosing GAPI!</p>
            <p>© ${new Date().getFullYear()} GAPI. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

export function createWelcomeEmailText(name: string): string {
  return `
Welcome to GAPI!

Hi ${name},

Your email has been successfully verified! You can now complete your membership registration and payment.

If you have any questions or need assistance, please don't hesitate to contact us.

Welcome to the GAPI community! 🎉

Thank you for choosing GAPI!

© ${new Date().getFullYear()} GAPI. All rights reserved.
  `.trim();
}
