// backend/src/db/initIndexes.ts
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import CheckoutSession from '../models/checkoutSession.model';
import MembershipLevel from '../models/membershipLevel.model';
import WebhookEvent from '../models/webhookEvent.model';

export async function initializeIndexes() {
  logger.info('Initializing database indexes...');
  
  try {
    // Drop old email index if it exists
    try {
      await mongoose.connection.db.collection('users').dropIndex('email_1');
      logger.info('Dropped old email index');
    } catch (error) {
      logger.debug('Old email index not found or already dropped');
    }

    // Drop old username index if it exists
    try {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      logger.info('Dropped old username index');
    } catch (error) {
      logger.debug('Old username index not found or already dropped');
    }

    // --- CheckoutSession ---
    await CheckoutSession.collection.createIndex(
      { userId: 1 },
      { name: 'idx_checkout_userId' }
    );
    await CheckoutSession.collection.createIndex(
      { stripeSessionId: 1 },
      { unique: true, name: 'uniq_stripeSessionId' }
    );
    await CheckoutSession.collection.createIndex(
      { verifyNonce: 1 },
      { name: 'idx_checkout_verifyNonce' }
    );
    await CheckoutSession.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
    );
    await CheckoutSession.collection.createIndex(
      { ready: 1 },
      { name: 'idx_checkout_ready' }
    );
    // Single active session per user/level to prevent duplicate Stripe checkout creation
    await CheckoutSession.collection.createIndex(
      { userId: 1, levelKey: 1, status: 1 },
      { 
        unique: true,
        partialFilterExpression: { status: 'CREATED' },
        name: 'uniq_user_level_active_session'
      }
    );

    // --- CheckoutSession webhook lookup indexes ---
    await CheckoutSession.collection.createIndex(
      { paymentIntentId: 1 },
      { unique: true, sparse: true, name: 'uniq_checkout_paymentIntentId' }
    );
    await CheckoutSession.collection.createIndex(
      { subscriptionId: 1 },
      { unique: true, sparse: true, name: 'uniq_checkout_subscriptionId' }
    );
    await CheckoutSession.collection.createIndex(
      { mode: 1, createdAt: -1 },
      { name: 'idx_checkout_mode_createdAt' }
    );
    await CheckoutSession.collection.createIndex(
      { priceId: 1 },
      { name: 'idx_checkout_priceId' }
    );
    await CheckoutSession.collection.createIndex(
      { stripeCustomerId: 1 },
      { name: 'idx_checkout_stripeCustomerId' }
    );


    // --- WebhookEvent ---
    await WebhookEvent.collection.createIndex(
      { eventId: 1 },
      { unique: true, name: 'uniq_eventId' }
    );
    await WebhookEvent.collection.createIndex(
      { eventType: 1 },
      { name: 'idx_eventType' }
    );
    await WebhookEvent.collection.createIndex(
      { status: 1, processedAt: 1 },
      { name: 'idx_status_processedAt' }
    );
    await WebhookEvent.collection.createIndex(
      { processedAt: 1 },
      { expireAfterSeconds: 7776000, name: 'ttl_processedAt_90d' }
    );

    // --- User ---
    // Unique identity indexes - only for ACTIVE users
    await User.collection.createIndex(
      { email: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { status: 'ACTIVE' },
        name: 'uniq_user_email_active_only'
      }
    );
    await User.collection.createIndex(
      { username: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { status: 'ACTIVE' },
        name: 'uniq_user_username_active_only'
      }
    );
    
    // Verification lookup index
    await User.collection.createIndex(
      { verificationTokenHash: 1 }, 
      { sparse: true, name: 'idx_user_verificationTokenHash' }
    );
    
    // Password reset lookup index
    await User.collection.createIndex(
      { resetTokenHash: 1 }, 
      { sparse: true, name: 'idx_user_resetTokenHash' }
    );
    
    // Common filtering indexes
    await User.collection.createIndex(
      { emailVerified: 1 }, 
      { name: 'idx_user_emailVerified' }
    );
    
    // Status-based indexes
    await User.collection.createIndex(
      { status: 1 },
      { name: 'idx_user_status' }
    );
    
    // Status change timestamp indexes
    await User.collection.createIndex(
      { deletedAt: 1 },
      { name: 'idx_user_deletedAt' }
    );
    await User.collection.createIndex(
      { refundedAt: 1 },
      { name: 'idx_user_refundedAt' }
    );
    

    
    // Stripe uniqueness index
    await User.collection.createIndex(
      { stripeCustomerId: 1 },
      { unique: true, sparse: true, name: 'uniq_user_stripeCustomerId' }
    );
    
    // TTL index for signupIntent cleanup
    await User.collection.createIndex(
      { 'signupIntent.expiresAt': 1 },
      { expireAfterSeconds: 0, name: 'ttl_signupIntent_expiresAt' }
    );

    // --- Subscription ---
    await Subscription.collection.createIndex(
      { userId: 1 },
      { name: 'idx_subscription_userId' }
    );
    await Subscription.collection.createIndex(
      { levelId: 1 },
      { name: 'idx_subscription_levelId' }
    );
    // One active subscription per user
    await Subscription.collection.createIndex(
      { userId: 1, status: 1 },
      { 
        unique: true, 
        partialFilterExpression: { status: 'ACTIVE' },
        name: 'uniq_user_active_subscription'
      }
    );
    // Performance index for profile lookups with recency sorting
    await Subscription.collection.createIndex(
      { userId: 1, status: 1, updatedAt: -1 },
      { name: 'idx_sub_user_status_recent' }
    );
    await Subscription.collection.createIndex(
      { gatewaySubId: 1 },
      { 
        unique: true, 
        partialFilterExpression: { gatewaySubId: { $type: 'string' } },
        name: 'uniq_gatewaySubId_partial'
      }
    );
    await Subscription.collection.createIndex(
      { status: 1, nextBillDate: 1 },
      { name: 'idx_subscription_status_nextBillDate' }
    );
    // Unique ONE_TIME subscription per user (idempotency)
    await Subscription.collection.createIndex(
      { userId: 1, gateway: 1, kind: 1 },
      { 
        unique: true, 
        partialFilterExpression: { kind: 'ONE_TIME' },
        name: 'uniq_one_time_subscription_per_user'
      }
    );

    // --- Order ---
    await Order.collection.createIndex(
      { gatewayPaymentId: 1 },
      { unique: true, sparse: true, name: 'uniq_gatewayPaymentId' }
    );
    await Order.collection.createIndex(
      { gatewayInvoiceId: 1 },
      { unique: true, sparse: true, name: 'uniq_gatewayInvoiceId' }
    );
    await Order.collection.createIndex(
      { userId: 1, paidAt: -1 },
      { name: 'idx_userId_paidAt' }
    );
    await Order.collection.createIndex(
      { userId: 1, status: 1 },
      { name: 'idx_userId_status' }
    );
    await Order.collection.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'idx_userId_createdAt' }
    );
    await Order.collection.createIndex(
      { subscriptionId: 1 },
      { name: 'idx_order_subscriptionId' }
    );
    await Order.collection.createIndex(
      { membershipLevelId: 1 },
      { name: 'idx_order_membershipLevelId' }
    );
    await Order.collection.createIndex(
      { status: 1, paidAt: -1 },
      { name: 'idx_order_status_paidAt' }
    );

    // --- MembershipLevel ---
    await MembershipLevel.collection.createIndex(
      { key: 1 },
      { unique: true, name: 'uniq_membership_key' }
    );

    logger.info('All database indexes initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database indexes:', error);
    throw error;
  }
}
