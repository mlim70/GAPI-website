// scripts/sendMigrationPasswordInvites.ts
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { formatInTimeZone } from 'date-fns-tz';
import User from '../backend/src/models/user.model';
import { issueResetTokenForUser } from '../backend/src/utils/accounts/tokens';
import { senderEmailService } from '../backend/src/utils/email/senderService';
import { logger } from '../backend/src/utils/general/logger';
import { MONGODB_URI } from '../backend/src/config/env';
import { getFrontendUrl } from '../backend/src/config/urls';

const RUN_ID = crypto.randomUUID(); // stable id for this execution

const HOURS = 144; // 6 days

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  delayBetweenRequests: 250, // 250ms delay between each request
  concurrency: 5, // Max 5 parallel requests
  maxRetries: 4, // Max 4 retry attempts
  retryBaseDelay: 1000, // Start with 1s retry delay
  retryMultiplier: 2, // Exponential backoff multiplier
  jitterPercent: 0.1, // ±10% jitter to prevent thundering herd
};

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Exponential backoff retry logic with jitter
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RATE_LIMIT_CONFIG.maxRetries,
  baseDelay: number = RATE_LIMIT_CONFIG.retryBaseDelay
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Enhanced retryable error detection
      const isRetryableError = 
        // HTTP-level errors
        error.response?.status === 429 || // Rate limit
        (error.response?.status >= 500 && error.response?.status <= 599) || // Server errors
        error.response?.status === 408 || // Request timeout
        error.response?.status === 503 || // Service unavailable
        error.response?.status === 504 || // Gateway timeout
        // Network-level errors (no error.response means network/connection issues)
        !error.response && (
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENETUNREACH' ||
          error.code === 'EAI_AGAIN' || // DNS lookup timeout
          error.message?.includes('timeout') ||
          error.message?.includes('network') ||
          error.message?.includes('connection')
        );
      
      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter: prevents thundering herd
      const exponentialDelay = baseDelay * Math.pow(RATE_LIMIT_CONFIG.retryMultiplier, attempt - 1);
      const jitter = (Math.random() - 0.5) * 2 * RATE_LIMIT_CONFIG.jitterPercent * exponentialDelay; // ±jitterPercent% jitter
      const finalDelay = Math.max(100, Math.round(exponentialDelay + jitter)); // Minimum 100ms delay
      
      logger.warn(`Attempt ${attempt}/${maxRetries} failed, retrying in ${finalDelay}ms...`, {
        error: error.message,
        httpStatus: error.response?.status || 'network_error',
        errorCode: error.code || 'unknown',
        baseDelay: exponentialDelay,
        jitter: Math.round(jitter),
        finalDelay
      });
      
      await sleep(finalDelay);
    }
  }
  
  throw lastError!;
}

// Process users in batches with concurrency control
async function processBatch(users: any[], startIndex: number): Promise<{ successCount: number; errorCount: number }> {
  const batch = users.slice(startIndex, startIndex + RATE_LIMIT_CONFIG.concurrency);
  
  if (batch.length === 0) return { successCount: 0, errorCount: 0 };
  
  let batchSuccessCount = 0;
  let batchErrorCount = 0;
  
  // Process batch with controlled concurrency
  await Promise.all(batch.map(async (user, batchIndex) => {
    const userIndex = startIndex + batchIndex;
    
    try {
      await retryWithBackoff(async () => {
        await sendInviteToUser(user);
      });
      
      batchSuccessCount++;
      logger.info(`✅ [${userIndex + 1}/${users.length}] Sent migration invite`, { 
        userId: user._id, 
        email: user.email 
      });
    } catch (error: any) {
      batchErrorCount++;
      logger.error(`❌ [${userIndex + 1}/${users.length}] Failed after retries`, { 
        userId: user._id, 
        email: user.email, 
        error: error.message 
      });
    }
    
    // Add delay between requests within the batch
    if (batchIndex < batch.length - 1) {
      await sleep(RATE_LIMIT_CONFIG.delayBetweenRequests);
    }
  }));
  
  return { successCount: batchSuccessCount, errorCount: batchErrorCount };
}

// Extract email sending logic to a separate function with atomic claiming
async function sendInviteToUser(user: any): Promise<void> {
  try {
    // 1) Try to claim this user atomically
    const claimRes = await User.updateOne(
      {
        _id: user._id,
        migrationPasswordInviteSentAt: { $exists: false },
        // Only claim users that are unprocessed or failed (not PENDING or SENT)
        $or: [
          { migrationPasswordInviteStatus: { $exists: false } },
          { migrationPasswordInviteStatus: 'ERROR' },
          { 
            migrationPasswordInviteStatus: 'PENDING', 
            migrationPasswordInvitePendingAt: { $lte: new Date(Date.now() - 15 * 60 * 1000) } 
          }
        ]
      },
      {
        $set: {
          migrationPasswordInviteStatus: 'PENDING',
          migrationPasswordInvitePendingAt: new Date(),
          migrationPasswordInviteRunId: RUN_ID
        }
      }
    );

    // If we didn't modify anything, someone else (or a previous run) already handled it. Skip.
    if (claimRes.modifiedCount === 0) {
      logger.info('↩️  Skipping (already claimed or sent)', { userId: user._id, email: user.email });
      return;
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('User not active');
    }

    const { rawToken, expires } = await issueResetTokenForUser(user._id.toString(), HOURS);
    
    // Construct membership URL using proper config
    const base = (process.env.CLIENT_URL || getFrontendUrl()).replace(/\/$/, '');
    const membershipUrl = `${base}/become-a-member`;

    // Absolute expiry string for the email (Eastern Time)
    const expiryDisplayNY = formatInTimeZone(expires, 'America/New_York', 'MMM d, yyyy h:mm a zzz');

    // Membership flags
    const LIFETIME_NAMES = new Set(['Lifetime', 'Student', 'Associate Life']);
    const isLifetime  = !!user.membershipLevel && LIFETIME_NAMES.has(user.membershipLevel);
    const isRecurring = !!user.membershipLevel && !LIFETIME_NAMES.has(user.membershipLevel);
    const isExpired   = !user.membershipLevel;

    // Compute a billing_deadline_date for recurring
    const billingDeadlineNY = formatInTimeZone(new Date(Date.now() + 21 * 24 * 3600 * 1000), 'America/New_York', 'MMM d, yyyy');

    // Ensure Sender.net is configured
    if (!senderEmailService.isServiceConfigured()) {
      throw new Error('Sender.net not configured');
    }

    // Generate idempotency key to prevent duplicate sends
    const idempotencyKey = `migration-invite:${user._id.toString()}`;

    await senderEmailService.sendMigrationPasswordInviteEmail(
      user.email,
      `${user.name?.first || ''} ${user.name?.last || ''}`.trim(),
      user._id.toString(),
      rawToken,
      {
        username: user.username,
        resetExpiresHours: HOURS,
        resetExpiresAtDisplay: expiryDisplayNY,
        is_lifetime: isLifetime,
        is_recurring: !!isRecurring,
        is_expired: !!isExpired,
        pricing_page_url: membershipUrl,
        billing_deadline_date: billingDeadlineNY,
        idempotencyKey
      }
    );

    // Mark as sent successfully
    await User.updateOne(
      { _id: user._id },
      {
        $unset: { migrationPasswordInvitePendingAt: 1, migrationPasswordInviteRunId: 1 },
        $set: {
          migrationPasswordInviteSentAt: new Date(),
          migrationPasswordInviteStatus: 'SENT'
        }
      }
    );

  } catch (err: any) {
    // Mark error state for potential re-runs
    await User.updateOne(
      { _id: user._id },
      {
        $unset: { migrationPasswordInvitePendingAt: 1, migrationPasswordInviteRunId: 1 },
        $set: {
          migrationPasswordInviteStatus: 'ERROR',
          migrationPasswordInviteErrorAt: new Date(),
          migrationPasswordInviteError: String(err?.message || err)
        }
      }
    );
    throw err; // Re-throw to maintain batch counting accuracy
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({
    status: 'ACTIVE',
    migratedFromLegacy: true,
    migrationPasswordInviteSentAt: { $exists: false },
  }).lean();

  logger.info(`📧 Found ${users.length} users for migration invites`);
  logger.info(`🆔 Run ID: ${RUN_ID}`);
  logger.info(`⚙️ Rate limiting: ${RATE_LIMIT_CONFIG.delayBetweenRequests}ms delay, ${RATE_LIMIT_CONFIG.concurrency} concurrent, ${RATE_LIMIT_CONFIG.maxRetries} retries`);
  logger.info(`♻️  To re-run failed attempts only, change query to: { migrationPasswordInviteStatus: 'ERROR' }`);

  if (users.length === 0) {
    logger.info('No users to process');
    await mongoose.disconnect();
    return;
  }

  const startTime = Date.now();
  let totalSuccessCount = 0;
  let totalErrorCount = 0;

  // Process users in batches with rate limiting
  for (let i = 0; i < users.length; i += RATE_LIMIT_CONFIG.concurrency) {
    const batchNumber = Math.floor(i / RATE_LIMIT_CONFIG.concurrency) + 1;
    const totalBatches = Math.ceil(users.length / RATE_LIMIT_CONFIG.concurrency);
    
    logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (users ${i + 1}-${Math.min(i + RATE_LIMIT_CONFIG.concurrency, users.length)})`);
    
    try {
      const { successCount, errorCount } = await processBatch(users, i);
      totalSuccessCount += successCount;
      totalErrorCount += errorCount;
      
      logger.info(`📊 Batch ${batchNumber} results: ${successCount} sent, ${errorCount} failed`);
    } catch (error: any) {
      // This catch should rarely trigger since processBatch handles individual errors
      logger.error(`❌ Batch ${batchNumber} processing error:`, error.message);
      const batchSize = Math.min(RATE_LIMIT_CONFIG.concurrency, users.length - i);
      totalErrorCount += batchSize; // Count all users in this batch as failed
    }
    
    // Add delay between batches (except for the last batch)
    if (i + RATE_LIMIT_CONFIG.concurrency < users.length) {
      await sleep(RATE_LIMIT_CONFIG.delayBetweenRequests * 2); // Extra delay between batches
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  logger.info(`🎉 Migration invite script completed in ${duration}s`);
  logger.info(`📊 Final Results: ${totalSuccessCount} sent, ${totalErrorCount} failed, ${users.length} total`);

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
