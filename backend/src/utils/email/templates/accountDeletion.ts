// Email template for account deletion confirmation

export function createAccountDeletionEmailHTML(
  name: string,
  deletionDate: Date,
  preservedData: {
    orderCount: number;
    totalSpent: number;
    subscriptionStatus: string;
  },
  originalEmail: string
): string {
  const deletionDateString = deletionDate.toLocaleDateString();
  const deletionTimeString = deletionDate.toLocaleTimeString();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your GAPI Account Has Been Deleted</title>
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
                color: #dc2626;
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
            .data-table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 20px 0; 
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .data-table th, .data-table td { 
                border: 1px solid #e5e7eb; 
                padding: 12px; 
                text-align: left; 
            }
            .data-table th { 
                background-color: #f9fafb; 
                font-weight: 600;
                color: #374151;
            }
            .data-table td {
                background-color: #ffffff;
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
                color: #dc2626;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">GAPI</div>
            <h2>Account Deletion Confirmation</h2>
        </div>
        
        <div class="content">
            <p>Hi ${name},</p>
            
            <p>Your GAPI account associated with <strong>${originalEmail}</strong> has been successfully deleted on ${deletionDateString} at ${deletionTimeString}.</p>
            
            <p>Here's a summary of your preserved data for compliance purposes:</p>
            
            <table class="data-table">
                <tr>
                    <th>Data Type</th>
                    <th>Details</th>
                </tr>
                <tr>
                    <td><strong>Number of Orders</strong></td>
                    <td>${preservedData.orderCount}</td>
                </tr>
                <tr>
                    <td><strong>Total Amount Spent</strong></td>
                    <td>$${preservedData.totalSpent.toFixed(2)}</td>
                </tr>
                <tr>
                    <td><strong>Subscription Status</strong></td>
                    <td>${preservedData.subscriptionStatus}</td>
                </tr>
            </table>
            
            <div class="warning-box">
                <strong>⚠️ Important Information:</strong>
                <ul>
                    <li>Your personal account data has been permanently deleted and anonymized.</li>
                    <li>You will no longer be able to access your account or its associated data.</li>
                    <li>Financial records are preserved for legal and compliance requirements.</li>
                    <li>If you believe this deletion was a mistake, please contact our support team immediately.</li>
                </ul>
            </div>
            
            <p><strong>Need Help?</strong> If you have any questions about this process or need assistance, please don't hesitate to reach out to our support team.</p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from GAPI. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} GAPI. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

export function createAccountDeletionEmailText(
  name: string,
  deletionDate: Date,
  preservedData: {
    orderCount: number;
    totalSpent: number;
    subscriptionStatus: string;
  },
  originalEmail: string
): string {
  const deletionDateString = deletionDate.toLocaleDateString();
  const deletionTimeString = deletionDate.toLocaleTimeString();

  return `
Your GAPI Account Has Been Deleted

Hi ${name},

Your GAPI account associated with ${originalEmail} has been successfully deleted on ${deletionDateString} at ${deletionTimeString}.

Here's a summary of your preserved data for compliance purposes:

PRESERVED DATA:
- Number of Orders: ${preservedData.orderCount}
- Total Amount Spent: $${preservedData.totalSpent.toFixed(2)}
- Subscription Status: ${preservedData.subscriptionStatus}

⚠️ IMPORTANT INFORMATION:
- Your personal account data has been permanently deleted and anonymized.
- You will no longer be able to access your account or its associated data.
- Financial records are preserved for legal and compliance requirements.
- If you believe this deletion was a mistake, please contact our support team immediately.

Need Help? If you have any questions about this process or need assistance, please don't hesitate to reach out to our support team.

This is an automated message from GAPI. Please do not reply to this email.

© ${new Date().getFullYear()} GAPI. All rights reserved.
  `.trim();
}
