# Email Queue System

## Overview

The email queue system has been implemented to improve webhook performance and scalability by moving email sending operations out of the main request flow. Instead of awaiting email sends (even with timeouts), the webhook now queues email jobs and returns immediately.

## Architecture

### Components

1. **EmailJob Model** (`src/models/emailJob.model.ts`)
   - MongoDB document to store queued email jobs
   - Tracks status, attempts, and retry logic
   - Supports multiple email types: welcome, passwordReset, contactForm, newsletter, verification

2. **Email Queue Utilities** (`src/utils/email/emailQueue.ts`)
   - Functions to queue different types of email jobs
   - Non-blocking operations that return immediately
   - Error handling that doesn't fail the webhook

3. **Email Worker Service** (`src/services/emailWorker.ts`)
   - Background service to process queued email jobs
   - Implements retry logic with exponential backoff
   - Handles job status updates and cleanup

4. **Worker Scripts** (`scripts/emailWorker.ts`, `scripts/setupCron.ts`)
   - Standalone scripts to run the email worker
   - Cron job setup instructions
   - Process management options

## How It Works

### Before (Blocking)
```typescript
// Old way - blocks webhook for up to 8 seconds
try {
  await withTimeout(sendWelcomeEmail(p.email, fullName), 8000);
  console.log(`✅ Welcome email sent to ${p.email}`);
} catch (emailError) {
  console.warn(`⚠️ Failed to send welcome email to ${p.email}:`, emailError);
}
```

### After (Non-blocking)
```typescript
// New way - returns immediately, processes in background
const fullName = `${p.name.first} ${p.name.last}`;
await queueWelcomeEmail(p.email, fullName);
console.log(`📧 Welcome email queued for ${p.email}`);
```

## Setup Instructions

### 1. Database Migration

The EmailJob collection will be created automatically when the first job is queued. No manual migration is required.

### 2. Run Email Worker

#### Option A: Manual Testing
```bash
cd backend
npm run email-worker
```

#### Option B: Cron Job (Recommended for Production)
```bash
# Setup cron instructions
npm run setup-cron

# Add to crontab (every 5 minutes)
*/5 * * * * cd /path/to/backend && npm run email-worker >> logs/email-worker.log 2>&1
```

#### Option C: PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js
module.exports = {
  apps: [{
    name: "email-worker",
    script: "npm",
    args: "run email-worker",
    cwd: "/path/to/backend",
    cron_restart: "*/5 * * * *",
    autorestart: false,
    watch: false
  }]
}

# Start the worker
pm2 start ecosystem.config.js
pm2 logs email-worker
```

### 3. Monitor and Debug

#### Check Job Status
```bash
# View email job statistics
curl http://localhost:4000/api/webhook/status
```

#### View Logs
```bash
# If using cron with logging
tail -f logs/email-worker.log

# If using PM2
pm2 logs email-worker
```

## Email Job Types

### Welcome Email
```typescript
await queueWelcomeEmail(email, fullName);
```

### Password Reset
```typescript
await queuePasswordResetEmail(email, resetToken);
```

### Contact Form
```typescript
await queueContactFormEmail(email, name, message);
```

### Newsletter
```typescript
await queueNewsletterEmail(email, newsletterType);
```

### Verification
```typescript
await queueVerificationEmail(email, verificationToken);
```

## Job Lifecycle

1. **Pending**: Job is created and ready for processing
2. **Processing**: Worker is actively sending the email
3. **Completed**: Email sent successfully
4. **Failed**: Email failed after max retry attempts

## Retry Logic

- **Max Attempts**: 3 (configurable)
- **Backoff Strategy**: Exponential backoff (1s, 2s, 4s, max 5 minutes)
- **Retry Conditions**: Network errors, temporary failures
- **Permanent Failures**: Marked as failed after max attempts

## Cleanup

- **Completed Jobs**: Kept for 30 days for audit purposes
- **Failed Jobs**: Kept for 30 days for debugging
- **Cleanup**: Runs automatically (20% chance per worker run)

## Performance Benefits

1. **Webhook Response Time**: Reduced from 8+ seconds to <100ms
2. **Scalability**: Webhook can handle more concurrent requests
3. **Reliability**: Failed emails are retried automatically
4. **Monitoring**: Better visibility into email delivery status
5. **Resource Usage**: No blocking I/O in webhook process

## Error Handling

- **Queue Failures**: Don't fail the webhook, log and continue
- **Email Failures**: Retry with exponential backoff
- **Permanent Failures**: Mark as failed and log for manual review
- **Worker Failures**: Log errors, continue processing other jobs

## Monitoring

### Health Check
```bash
curl http://localhost:4000/api/webhook/health
```

### Status Endpoint
```bash
curl http://localhost:4000/api/webhook/status
```

### Job Statistics
The email worker logs statistics after each run:
```
📊 Email job stats: { pending: 5, processing: 0, completed: 150, failed: 2, total: 157 }
```

## Troubleshooting

### Common Issues

1. **Jobs not processing**: Check if email worker is running
2. **High failure rate**: Check email service configuration
3. **Jobs stuck in processing**: Worker may have crashed, restart it
4. **Database connection issues**: Check MongoDB connection

### Debug Commands

```bash
# Check email worker status
npm run email-worker

# View cron setup
npm run setup-cron

# Check webhook health
curl http://localhost:4000/api/webhook/health

# Check webhook status
curl http://localhost:4000/api/webhook/status
```

## Future Enhancements

- [ ] Priority queues for different email types
- [ ] Dead letter queue for permanently failed jobs
- [ ] Webhook endpoint to manually retry failed jobs
- [ ] Email delivery confirmation tracking
- [ ] Rate limiting per recipient
- [ ] Batch email processing
- [ ] Email template management
- [ ] A/B testing support
