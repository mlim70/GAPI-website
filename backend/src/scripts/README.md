# Sender.net Service Test Scripts

This directory contains scripts to test and debug the Sender.net email service configuration and API endpoints.

## Problem Description

The GAPI website is experiencing issues with sending verification emails through Sender.net. The error logs show:

```
❌ Error sending verification email: Error: Failed to send verification email: Failed to send email: Request failed with status code 404
```

This indicates that the `/emails` endpoint is returning a 404 error, which could be due to:
1. Incorrect API endpoint
2. Invalid API key or domain
3. Sender.net plan limitations
4. API structure changes

## Available Scripts

### 1. TypeScript Version (`testSenderService.ts`)
- **Usage**: `npm run test:sender`
- **Requirements**: TypeScript environment with tsx
- **Features**: Full TypeScript support, better error handling

### 2. JavaScript Version (`testSenderService.js`)
- **Usage**: `npm run test:sender:js`
- **Requirements**: Node.js only
- **Features**: Can run directly without compilation

## How to Run

### Option 1: Using npm scripts (Recommended)
```bash
# Navigate to backend directory
cd backend

# Run TypeScript version
npm run test:sender

# Run JavaScript version
npm run test:sender:js
```

### Option 2: Direct execution
```bash
# Navigate to backend directory
cd backend

# Run TypeScript version with tsx
npx tsx src/scripts/testSenderService.ts

# Run JavaScript version directly
node src/scripts/testSenderService.js
```

## What the Script Tests

The script performs comprehensive testing of the Sender.net service:

### 1. Environment Variables
- ✅ `SENDER_API_KEY` - API key for authentication
- ✅ `SENDER_DOMAIN` - Domain for sending emails
- ✅ `SENDER_LIST_ID` - Newsletter list ID

### 2. API Key Validation
- ✅ Format validation (alphanumeric, minimum length)
- ✅ Presence check

### 3. Domain Validation
- ✅ Domain format validation
- ✅ DNS-like structure check

### 4. API Connectivity
- ✅ Basic API connectivity test
- ✅ Authentication test using `/domains` endpoint

### 5. Endpoint Testing
- ✅ `/emails` - Main email sending endpoint
- ✅ `/subscribers` - Newsletter management
- ✅ `/domains` - Domain management
- ✅ `/lists` - List management
- ✅ `/templates` - Email templates
- ✅ `/campaigns` - Campaign management
- ✅ `/transactions` - Transactional emails

### 6. Alternative Endpoint Testing
- ✅ Tests alternative endpoints that might work for your plan
- ✅ Helps identify which endpoints are available

## Expected Output

The script provides detailed logging and a comprehensive report:

```
🚀 Starting Sender.net Service Tests...
   API Key: Present
   Domain: yourdomain.com
   List ID: 12345
   Base URL: https://api.sender.net/v2

🔍 Testing environment variables...
✅ Environment Variables Check

🔍 Testing API key format...
✅ API Key Format Check

🔍 Testing domain format...
✅ Domain Format Check

🔍 Testing API connectivity...
✅ API Connectivity Test

🔍 Testing /emails endpoint...
❌ /emails Endpoint Test
   Error: Emails endpoint failed: Request failed with status code 404

📊 SENDER.NET SERVICE TEST REPORT
================================================================================
Total Tests: 15
Passed: 14 ✅
Failed: 1 ❌
Success Rate: 93.3%

❌ FAILED TESTS:

   /emails Endpoint Test:
   Error: Emails endpoint failed: Request failed with status code 404
   Details: {
     "endpoint": "https://api.sender.net/v2/emails",
     "status": 404,
     "statusText": "Not Found"
   }

🔍 RECOMMENDATIONS:

   • The /emails endpoint may not be available in your plan
   • Consider using /transactions or /campaigns instead
   • Check Sender.net documentation for your plan's available endpoints
```

## Troubleshooting Common Issues

### 1. Missing Environment Variables
**Error**: `Missing required environment variables`
**Solution**: Ensure your `.env` file contains:
```env
SENDER_API_KEY=your_api_key_here
SENDER_DOMAIN=yourdomain.com
SENDER_LIST_ID=your_list_id_here
```

### 2. API Key Invalid
**Error**: `API request failed: 401 Unauthorized`
**Solution**: 
- Check your Sender.net API key
- Verify the key is active and not expired
- Ensure you have the correct permissions

### 3. Domain Not Verified
**Error**: `Domain format appears invalid`
**Solution**:
- Verify your domain in Sender.net dashboard
- Ensure DNS records are properly configured
- Check domain verification status

### 4. Endpoint Not Available (404)
**Error**: `Request failed with status code 404`
**Solution**:
- Check your Sender.net plan features
- Some endpoints may not be available in free/basic plans
- Consider upgrading your plan or using alternative endpoints

### 5. Rate Limiting
**Error**: `429 Too Many Requests`
**Solution**:
- Check your plan's rate limits
- Implement proper rate limiting in your application
- Consider upgrading your plan

## Alternative Solutions

If the `/emails` endpoint is not available, consider these alternatives:

### 1. Use `/transactions` Endpoint
```typescript
// In senderService.ts
const response = await axios.post(`${this.baseUrl}/transactions`, emailData, {
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

### 2. Use Newsletter Functionality
```typescript
// Send transactional emails through newsletter system
const response = await axios.post(`${this.baseUrl}/campaigns`, {
  name: 'Verification Email',
  subject: 'Verify Your Account',
  html_content: htmlContent,
  list_id: config.listId
});
```

### 3. Check Sender.net Documentation
- Review your plan's available endpoints
- Check for API changes or deprecations
- Contact Sender.net support for clarification

## Next Steps

1. **Run the test script** to identify the specific issue
2. **Check your Sender.net plan** for available endpoints
3. **Verify environment variables** are correctly set
4. **Test alternative endpoints** if `/emails` is not available
5. **Update the service code** to use working endpoints
6. **Monitor logs** for successful email sending

## Support

If you continue to experience issues:
1. Check Sender.net status page
2. Review Sender.net API documentation
3. Contact Sender.net support
4. Consider alternative email services (SendGrid, Mailgun, etc.)

## Files

- `testSenderService.ts` - TypeScript version with full type safety
- `testSenderService.js` - JavaScript version for direct execution
- `README.md` - This documentation file
