# Mailgun Setup Guide for GAPI

This guide will help you set up and test your Mailgun email service integration.

## Prerequisites

1. A Mailgun account with an API key
2. A verified domain in Mailgun (e.g., `mg.gapi.org`)
3. Your backend running on port 4000

## Environment Variables

Add these to your `.env` file in the backend directory:

```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=mg.gapi.org
```

## Testing Your Connection

### Method 1: Command Line Test

Run the standalone test script:

```bash
cd backend
node test-mailgun.js
```

**Before running:** Edit `test-mailgun.js` and change the `to` email address to your actual email.

### Method 2: API Endpoint Test

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Open `test-mailgun.html` in your browser (double-click the file)

3. Fill in your email address and click "Send Test Email"

### Method 3: Direct API Calls

Test the status endpoint:
```bash
curl http://localhost:4000/api/mailgun/status
```

Send a test email:
```bash
curl -X POST http://localhost:4000/api/mailgun/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test from GAPI",
    "text": "Hello from Mailgun!"
  }'
```

## API Endpoints

- `GET /api/mailgun/status` - Check configuration status
- `POST /api/mailgun/test-email` - Send a test email

## Troubleshooting

### Common Issues

1. **"MAILGUN_API_KEY not configured"**
   - Check that your `.env` file has the correct variable name
   - Restart your backend after adding environment variables

2. **"Domain not found"**
   - Verify your domain is correct in Mailgun dashboard
   - Check that `MAILGUN_DOMAIN` matches exactly

3. **"Forbidden" or "Unauthorized"**
   - Verify your API key is correct
   - Check that your API key hasn't expired
   - Ensure your domain is verified in Mailgun

4. **"Network Error"**
   - Make sure your backend is running on port 4000
   - Check that CORS is properly configured

### Verification Steps

1. **Check Mailgun Dashboard:**
   - Log into your Mailgun account
   - Verify your domain status is "Active"
   - Confirm your API key is valid

2. **Check Environment Variables:**
   - Use the status endpoint: `GET /api/mailgun/status`
   - Verify both API key and domain show as configured

3. **Check Backend Logs:**
   - Look for Mailgun-related console output
   - Check for any error messages

## Integration with Existing Email System

The Mailgun test routes are separate from your existing Sender.net email system. Once you've verified Mailgun is working, you can:

1. Update your email utility functions to use Mailgun instead of Sender.net
2. Remove the Sender.net dependencies
3. Update your environment variables

## Security Notes

- Never commit your `.env` file to version control
- Your API key is sensitive - keep it secure
- The test endpoints are for development only - consider removing them in production

## Next Steps

After successful testing:

1. Integrate Mailgun into your existing email functions
2. Update your email templates for Mailgun
3. Test with your actual email verification flow
4. Monitor your Mailgun dashboard for delivery statistics
