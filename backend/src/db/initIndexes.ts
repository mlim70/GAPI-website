import CheckoutSession from '../models/checkoutSession.model';
import PendingUser from '../models/pendingUser.model';
import WebhookEvent from '../models/webhookEvent.model';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import MembershipLevel from '../models/membershipLevel.model';
import BillingProfile from '../models/billingProfile.model';

export async function initIndexes() {
  console.log('🔧 Initializing database indexes...');

  // --- CheckoutSession ---
  await CheckoutSession.collection.createIndex(
    { stripeSessionId: 1 },
    {
      name: 'uniq_stripeSessionId_partial',
      unique: true,
      partialFilterExpression: { stripeSessionId: { $exists: true } } // simpler & robust
    }
  );
  await CheckoutSession.collection.createIndex({ pendingUserId: 1 }, { name: 'idx_pendingUserId' });
  await CheckoutSession.collection.createIndex({ ready: 1, status: 1 }, { name: 'idx_ready_status' });
  await CheckoutSession.collection.createIndex({ stripeSessionId: 1, pendingUserId: 1 }, { name: 'idx_stripeSessionId_pendingUserId' });
  await CheckoutSession.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });
  await CheckoutSession.collection.createIndex({ finalizing: 1 }, { name: 'idx_finalizing' });
  await CheckoutSession.collection.createIndex({ billingProfileId: 1 }, { name: 'idx_checkout_billingProfileId' });
  await CheckoutSession.collection.createIndex({ beneficiaryUserId: 1 }, { name: 'idx_checkout_beneficiaryUserId' });
  await CheckoutSession.collection.createIndex(
    { stripeSessionId: 1, status: 1 },
    { name: 'idx_checkout_session_status' }
  );

  // --- BillingProfile ---
  await BillingProfile.collection.createIndex(
    { stripeCustomerId: 1 },
    { name: 'uniq_cus', unique: true, partialFilterExpression: { stripeCustomerId: { $type: 'string' } } }
  );
  await BillingProfile.collection.createIndex({ ownerUserId: 1 }, { name: 'idx_owner' });
  await BillingProfile.collection.createIndex({ normalizedEmail: 1 }, { name: 'idx_normEmail' });

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
    { eventId: 1, claimed: 1 },
    { name: 'idx_eventId_claimed' }
  );
  await WebhookEvent.collection.createIndex(
    { eventId: 1, status: 1 },
    { name: 'idx_eventId_status' }
  );
  await WebhookEvent.collection.createIndex(
    { processedAt: 1 },
    { expireAfterSeconds: 7776000, name: 'ttl_processedAt_90d' }
  );

  // --- User ---
  await User.collection.createIndex({ email: 1 }, { unique: true, name: 'uniq_user_email' });
  await User.collection.createIndex({ username: 1 }, { unique: true, name: 'uniq_user_username' });
  await User.collection.createIndex({ stripeCustomerId: 1 }, { name: 'idx_user_stripeCustomerId', sparse: true });

  // --- Subscription ---
  await Subscription.collection.createIndex(
    { userId: 1 },
    { name: 'idx_subscription_userId' }
  );
  await Subscription.collection.createIndex(
    { levelId: 1 },
    { name: 'idx_subscription_levelId' }
  );
  await Subscription.collection.createIndex(
    { userId: 1, status: 1 },
    { 
      unique: true, 
      partialFilterExpression: { status: 'ACTIVE' },
      name: 'uniq_user_active_subscription'
    }
  );
  await Subscription.collection.createIndex(
    { beneficiaryUserId: 1, status: 1 },
    { 
      unique: true, 
      partialFilterExpression: { status: 'ACTIVE' },
      name: 'uniq_beneficiary_active_subscription'
    }
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
    { userId: 1 },
    { name: 'idx_order_userId' }
  );
  await Order.collection.createIndex(
    { subscriptionId: 1 },
    { name: 'idx_order_subscriptionId' }
  );
  await Order.collection.createIndex(
    { membershipLevelId: 1 },
    { name: 'idx_order_membershipLevelId' }
  );

  // --- MembershipLevel ---
  await MembershipLevel.collection.createIndex(
    { key: 1 },
    { unique: true, name: 'uniq_membership_key' }
  );

  console.log('✅ All database indexes initialized successfully');
}
