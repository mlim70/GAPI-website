import mongoose from 'mongoose';
import User from '../models/user.model';
import PendingUser from '../models/pendingUser.model';
import WebhookEvent from '../models/webhookEvent.model';
import CheckoutSession from '../models/checkoutSession.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import MembershipLevel from '../models/membershipLevel.model';
import EmailJob from '../models/emailJob.model';

export async function initIndexes() {
  console.log('🔧 Initializing database indexes...');

  // --- EmailJob ---
  await EmailJob.collection.createIndex(
    { status: 1, priorityWeight: -1, nextAttemptAt: 1, createdAt: 1 },
    { name: 'idx_emailjob_pending_by_priority' }
  );
  await EmailJob.collection.createIndex(
    { createdAt: 1 },
    { name: 'idx_emailjob_createdAt' }
  );

  // --- CheckoutSession ---
  await CheckoutSession.collection.createIndex(
    { pendingUserId: 1 },
    { name: 'idx_checkout_pendingUserId' }
  );
  await CheckoutSession.collection.createIndex(
    { stripeSessionId: 1 },
    { unique: true, sparse: true, name: 'uniq_stripeSessionId' }
  );
  await CheckoutSession.collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
  );
  await CheckoutSession.collection.createIndex(
    { status: 1 },
    { name: 'idx_checkout_session_status' }
  );
  await CheckoutSession.collection.createIndex(
    { customerId: 1 },
    { name: 'idx_checkout_customerId' }
  );
  await CheckoutSession.collection.createIndex(
    { priceId: 1 },
    { name: 'idx_checkout_priceId' }
  );
  await CheckoutSession.collection.createIndex(
    { ready: 1 },
    { name: 'idx_checkout_ready' }
  );
  await CheckoutSession.collection.createIndex(
    { stripeSessionStatus: 1 },
    { name: 'idx_checkout_stripeSessionStatus' }
  );
  await CheckoutSession.collection.createIndex(
    { stripePaymentStatus: 1 },
    { name: 'idx_checkout_stripePaymentStatus' }
  );
  await CheckoutSession.collection.createIndex(
    { completedAt: 1 },
    { name: 'idx_checkout_completedAt' }
  );

  // --- PendingUser ---
  await PendingUser.collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
  );

  await PendingUser.collection.createIndex(
    { username: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 }, name: 'uniq_username_case_insensitive' }
  );
  await PendingUser.collection.createIndex(
    { email: 1 },
    { unique: true, name: 'uniq_pending_email' }
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
  await User.collection.createIndex({ email: 1 }, { unique: true, name: 'uniq_user_email' });
  await User.collection.createIndex({ username: 1 }, { unique: true, name: 'uniq_user_username' });
  await User.collection.createIndex(
    { stripeCustomerId: 1 },
    { unique: true, sparse: true, name: 'uniq_user_stripeCustomerId' }
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

  console.log('✅ All database indexes initialized successfully');
}
