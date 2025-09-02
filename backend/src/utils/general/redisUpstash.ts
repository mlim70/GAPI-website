// backend/src/utils/general/redisUpstash.ts
import { config } from 'dotenv';
import path from 'path';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

// Configure dotenv to find the .env file in the backend directory
config({ path: path.resolve(__dirname, '../../../.env') });

// Initialize Redis connection
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Test Redis connection on module load
async function testRedisConnection() {
  try {
    await redis.ping();
    logger.info('✅ Upstash Redis connection successful');
  } catch (error: any) {
    logger.warn('⚠️ Upstash Redis connection failed', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      body: error?.body
    });
  }
}

// Test connection in background (non-blocking)
testRedisConnection().catch(() => {
  // Silently fail - the warning is already logged above
});

export default redis;
