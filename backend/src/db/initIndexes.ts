import CheckoutSession from '../models/checkoutSession.model';
import PendingUser from '../models/pendingUser.model';
import WebhookEvent from '../models/webhookEvent.model';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import MembershipLevel from '../models/membershipLevel.model';

export async function initIndexes() {
  console.log('🔧 Initializing database indexes...');

  // CheckoutSession indexes
  try {
    // Unique constraint on stripeSessionId (prevents duplicates under load)
    await CheckoutSession.collection.createIndex(
      { stripeSessionId: 1 },
      { unique: true, sparse: true, name: 'uniq_stripeSessionId' }
    );
    console.log('✅ CheckoutSession stripeSessionId unique index created');

    // Pending user ID index for fallback lookups
    await CheckoutSession.collection.createIndex(
      { pendingUserId: 1 },
      { name: 'idx_pendingUserId' }
    );
    console.log('✅ CheckoutSession pendingUserId index created');

    // Compound index for frequent polling queries
    await CheckoutSession.collection.createIndex(
      { ready: 1, status: 1 },
      { name: 'idx_ready_status' }
    );
    console.log('✅ CheckoutSession ready_status compound index created');

    // Compound index for $or queries
    await CheckoutSession.collection.createIndex(
      { stripeSessionId: 1, pendingUserId: 1 },
      { name: 'idx_stripeSessionId_pendingUserId' }
    );
    console.log('✅ CheckoutSession stripeSessionId_pendingUserId compound index created');

    // TTL index for automatic cleanup (24 hours)
    await CheckoutSession.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 86400, name: 'ttl_expiresAt_24h' }
    );
    console.log('✅ CheckoutSession TTL index created');

    // Finalization lock index for efficient lock queries
    await CheckoutSession.collection.createIndex(
      { finalizing: 1 },
      { name: 'idx_finalizing' }
    );
    console.log('✅ CheckoutSession finalizing index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ CheckoutSession indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating CheckoutSession indexes:', error.message);
    }
  }

  // PendingUser indexes
  try {
    // TTL index for automatic cleanup
    await PendingUser.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
    );
    console.log('✅ PendingUser expiresAt TTL index created');

    // Secondary TTL index for email verification tokens
    await PendingUser.collection.createIndex(
      { emailVerificationTokenExpires: 1 },
      { expireAfterSeconds: 0, name: 'ttl_emailVerificationTokenExpires' }
    );
    console.log('✅ PendingUser emailVerificationTokenExpires TTL index created');

    // Case-insensitive username index (already defined in schema, but ensure it exists)
    await PendingUser.collection.createIndex(
      { username: 1 },
      { unique: true, collation: { locale: 'en', strength: 2 }, name: 'uniq_username_case_insensitive' }
    );
    console.log('✅ PendingUser username case-insensitive index created');

    // Email unique index
    await PendingUser.collection.createIndex(
      { email: 1 },
      { unique: true, name: 'uniq_pending_email' }
    );
    console.log('✅ PendingUser email unique index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ PendingUser indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating PendingUser indexes:', error.message);
    }
  }

  // WebhookEvent indexes
  try {
    // Event ID unique index (prevents duplicate webhook processing)
    await WebhookEvent.collection.createIndex(
      { eventId: 1 },
      { unique: true, name: 'uniq_eventId' }
    );
    console.log('✅ WebhookEvent eventId unique index created');

    // Event type index for filtering
    await WebhookEvent.collection.createIndex(
      { eventType: 1 },
      { name: 'idx_eventType' }
    );
    console.log('✅ WebhookEvent eventType index created');

    // Claim index for efficient claim queries
    await WebhookEvent.collection.createIndex(
      { eventId: 1, claimed: 1 },
      { name: 'idx_eventId_claimed' }
    );
    console.log('✅ WebhookEvent eventId_claimed compound index created');

    // Status index for failed event reclamation
    await WebhookEvent.collection.createIndex(
      { eventId: 1, status: 1 },
      { name: 'idx_eventId_status' }
    );
    console.log('✅ WebhookEvent eventId_status compound index created');

    // TTL index for automatic cleanup (90 days)
    await WebhookEvent.collection.createIndex(
      { processedAt: 1 },
      { expireAfterSeconds: 7776000, name: 'ttl_processedAt_90d' }
    );
    console.log('✅ WebhookEvent TTL index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ WebhookEvent indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating WebhookEvent indexes:', error.message);
    }
  }

  // User indexes
  try {
    // Email unique index
    await User.collection.createIndex(
      { email: 1 },
      { unique: true, name: 'uniq_user_email' }
    );
    console.log('✅ User email unique index created');

    // Username unique index
    await User.collection.createIndex(
      { username: 1 },
      { unique: true, name: 'uniq_user_username' }
    );
    console.log('✅ User username unique index created');

    // TTL index for reset tokens
    await User.collection.createIndex(
      { resetTokenExpires: 1 },
      { expireAfterSeconds: 0, name: 'ttl_resetTokenExpires' }
    );
    console.log('✅ User resetTokenExpires TTL index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ User indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating User indexes:', error.message);
    }
  }

  // Subscription indexes
  try {
    // User ID index for user lookups
    await Subscription.collection.createIndex(
      { userId: 1 },
      { name: 'idx_subscription_userId' }
    );
    console.log('✅ Subscription userId index created');

    // Level ID index for level lookups
    await Subscription.collection.createIndex(
      { levelId: 1 },
      { name: 'idx_subscription_levelId' }
    );
    console.log('✅ Subscription levelId index created');

    // Partial unique index for active subscriptions per user
    await Subscription.collection.createIndex(
      { userId: 1, status: 1 },
      { 
        unique: true, 
        partialFilterExpression: { status: 'ACTIVE' },
        name: 'uniq_user_active_subscription'
      }
    );
    console.log('✅ Subscription user_active partial unique index created');

    // Unique index on gatewaySubId, but only when present (partial filter)
    await Subscription.collection.createIndex(
      { gatewaySubId: 1 },
      { 
        unique: true, 
        partialFilterExpression: { gatewaySubId: { $type: 'string' } },
        name: 'uniq_gatewaySubId_partial'
      }
    );
    console.log('✅ Subscription gatewaySubId partial unique index created');

    // Status and nextBillDate index for billing queries
    await Subscription.collection.createIndex(
      { status: 1, nextBillDate: 1 },
      { name: 'idx_subscription_status_nextBillDate' }
    );
    console.log('✅ Subscription status_nextBillDate index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ Subscription indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating Subscription indexes:', error.message);
    }
  }

  // Order indexes
  try {
    // Gateway payment ID unique index
    await Order.collection.createIndex(
      { gatewayPaymentId: 1 },
      { unique: true, sparse: true, name: 'uniq_gatewayPaymentId' }
    );
    console.log('✅ Order gatewayPaymentId unique index created');

    // User ID index for order lookups
    await Order.collection.createIndex(
      { userId: 1 },
      { name: 'idx_order_userId' }
    );
    console.log('✅ Order userId index created');

    // Subscription ID index for order lookups
    await Order.collection.createIndex(
      { subscriptionId: 1 },
      { name: 'idx_order_subscriptionId' }
    );
    console.log('✅ Order subscriptionId index created');

    // Membership level ID index for order lookups
    await Order.collection.createIndex(
      { membershipLevelId: 1 },
      { name: 'idx_order_membershipLevelId' }
    );
    console.log('✅ Order membershipLevelId index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ Order indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating Order indexes:', error.message);
    }
  }

  // MembershipLevel indexes
  try {
    // Key unique index
    await MembershipLevel.collection.createIndex(
      { key: 1 },
      { unique: true, name: 'uniq_membership_key' }
    );
    console.log('✅ MembershipLevel key unique index created');
  } catch (error: any) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log('ℹ️ MembershipLevel indexes already exist with different options - this is okay');
    } else {
      console.log('⚠️ Error creating MembershipLevel indexes:', error.message);
    }
  }

  console.log('✅ All database indexes initialized successfully');
}
