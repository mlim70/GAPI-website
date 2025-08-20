import 'dotenv/config'
import { connectToDatabase } from '../src/utils/db';
import WebhookEvent from '../src/models/webhookEvent.model';
import User from '../src/models/user.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import Subscription from '../src/models/subscription.model';
import Order from '../src/models/order.model';
import MembershipLevel from '../src/models/membershipLevel.model';
import { stripe } from '../src/lib/stripe';

interface DebugStats {
  totalUsers: number;
  usersByStatus: Record<string, number>;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
  subscriptionsByKind: Record<string, number>;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalWebhookEvents: number;
  webhookEventsByStatus: Record<string, number>;
  webhookEventsByType: Record<string, number>;
  totalCheckoutSessions: number;
  checkoutSessionsByStatus: Record<string, number>;
  totalMembershipLevels: number;
  stripeCustomers: number;
  usersWithSignupIntent: number;
  usersWithMembershipLevel: number;
}

async function debugWebhook() {
  try {
    await connectToDatabase();
    console.log('✅ Database connected successfully');

    console.log('\n🔍 ===========================================');
    console.log('🔍 COMPREHENSIVE WEBHOOK & USER FLOW DEBUG');
    console.log('🔍 ===========================================');

    // 1. SYSTEM OVERVIEW
    await displaySystemOverview();

    // 2. USER STATUS ANALYSIS
    await analyzeUserStatuses();

    // 3. AUTHENTICATION FLOW DEBUG
    await debugAuthenticationFlows();

    // 4. CHECKOUT FLOW DEBUG
    await debugCheckoutFlows();

    // 5. WEBHOOK PROCESSING DEBUG
    await debugWebhookProcessing();

    // 6. SUBSCRIPTION & ORDER DEBUG
    await debugSubscriptionsAndOrders();

    // 7. EDGE CASES & ERROR SCENARIOS
    await debugEdgeCases();

    // 8. STRIPE INTEGRATION DEBUG
    await debugStripeIntegration();

    // 9. DATA CONSISTENCY CHECKS
    await checkDataConsistency();

    console.log('\n🔍 ===========================================');
    console.log('🔍 DEBUG COMPLETE');
    console.log('🔍 ===========================================');

  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    process.exit(0);
  }
}

async function displaySystemOverview() {
  console.log('\n📊 1. SYSTEM OVERVIEW');
  console.log('📊 ===================');

  const stats: DebugStats = {
    totalUsers: 0,
    usersByStatus: {},
    totalSubscriptions: 0,
    subscriptionsByStatus: {},
    subscriptionsByKind: {},
    totalOrders: 0,
    ordersByStatus: {},
    totalWebhookEvents: 0,
    webhookEventsByStatus: {},
    webhookEventsByType: {},
    totalCheckoutSessions: 0,
    checkoutSessionsByStatus: {},
    totalMembershipLevels: 0,
    stripeCustomers: 0,
    usersWithSignupIntent: 0,
    usersWithMembershipLevel: 0
  };

  // Count users by status
  const users = await User.find({});
  stats.totalUsers = users.length;
  
  users.forEach(user => {
    const status = user.status;
    stats.usersByStatus[status] = (stats.usersByStatus[status] || 0) + 1;
    
    if (user.stripeCustomerId) stats.stripeCustomers++;
    if (user.signupIntent) stats.usersWithSignupIntent++;
    if (user.membershipLevel) stats.usersWithMembershipLevel++;
  });

  // Count subscriptions
  const subscriptions = await Subscription.find({});
  stats.totalSubscriptions = subscriptions.length;
  
  subscriptions.forEach(sub => {
    const status = sub.status;
    const kind = sub.kind;
    stats.subscriptionsByStatus[status] = (stats.subscriptionsByStatus[status] || 0) + 1;
    stats.subscriptionsByKind[kind] = (stats.subscriptionsByKind[kind] || 0) + 1;
  });

  // Count orders
  const orders = await Order.find({});
  stats.totalOrders = orders.length;
  
  orders.forEach(order => {
    const status = order.status;
    stats.ordersByStatus[status] = (stats.ordersByStatus[status] || 0) + 1;
  });

  // Count webhook events
  const webhookEvents = await WebhookEvent.find({});
  stats.totalWebhookEvents = webhookEvents.length;
  
  webhookEvents.forEach(event => {
    const status = event.status;
    const type = event.eventType;
    stats.webhookEventsByStatus[status] = (stats.webhookEventsByStatus[status] || 0) + 1;
    stats.webhookEventsByType[type] = (stats.webhookEventsByType[type] || 0) + 1;
  });

  // Count checkout sessions
  const checkoutSessions = await CheckoutSession.find({});
  stats.totalCheckoutSessions = checkoutSessions.length;
  
  checkoutSessions.forEach(session => {
    const status = session.status;
    stats.checkoutSessionsByStatus[status] = (stats.checkoutSessionsByStatus[status] || 0) + 1;
  });

  // Count membership levels
  const membershipLevels = await MembershipLevel.find({});
  stats.totalMembershipLevels = membershipLevels.length;

  console.log(`👥 Total Users: ${stats.totalUsers}`);
  console.log(`💳 Total Subscriptions: ${stats.totalSubscriptions}`);
  console.log(`🧾 Total Orders: ${stats.totalOrders}`);
  console.log(`🔔 Total Webhook Events: ${stats.totalWebhookEvents}`);
  console.log(`🛒 Total Checkout Sessions: ${stats.totalCheckoutSessions}`);
  console.log(`🏷️ Total Membership Levels: ${stats.totalMembershipLevels}`);
  console.log(`🔗 Stripe Customers: ${stats.stripeCustomers}`);
  console.log(`🎯 Users with Signup Intent: ${stats.usersWithSignupIntent}`);
  console.log(`⭐ Users with Membership Level: ${stats.usersWithMembershipLevel}`);

  return stats;
}

async function analyzeUserStatuses() {
  console.log('\n👥 2. USER STATUS ANALYSIS');
  console.log('👥 ========================');

  // Get all users with their current status
  const users = await User.find({}).select('email username status createdAt signupIntent membershipLevel stripeCustomerId');
  
  const statusGroups: Record<string, any[]> = {};
  users.forEach(user => {
    if (!statusGroups[user.status]) statusGroups[user.status] = [];
    statusGroups[user.status].push(user);
  });

  // Analyze each status group
  for (const [status, usersInStatus] of Object.entries(statusGroups)) {
    console.log(`\n📋 Status: ${status} (${usersInStatus.length} users)`);
    
    if (status === 'VERIFIED_PENDING_PAYMENT') {
      console.log('⚠️  These users are ready for checkout but haven\'t paid yet');
      usersInStatus.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - Created: ${user.createdAt?.toISOString()}`);
        if (user.signupIntent) {
          console.log(`     🎯 Signup Intent: ${user.signupIntent.levelKey} (expires: ${user.signupIntent.expiresAt?.toISOString()})`);
        }
      });
    } else if (status === 'ACTIVE') {
      console.log('✅ These users have active memberships');
      usersInStatus.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - Level: ${user.membershipLevel || 'N/A'}`);
        if (user.stripeCustomerId) {
          console.log(`     🔗 Stripe Customer: ${user.stripeCustomerId}`);
        }
      });
    } else if (status === 'PENDING_VERIFICATION') {
      console.log('⏳ These users haven\'t verified their email yet');
      usersInStatus.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - Created: ${user.createdAt?.toISOString()}`);
      });
    } else if (status === 'REFUNDED') {
      console.log('↩️ These users have been refunded');
      usersInStatus.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - Refunded: ${(user as any).refundedAt?.toISOString() || 'N/A'}`);
      });
    } else if (status === 'DELETED') {
      console.log('🗑️ These users have been deleted');
      usersInStatus.forEach(user => {
        console.log(`   - ${user.email} (${user.username}) - Deleted: ${(user as any).deletedAt?.toISOString() || 'N/A'}`);
      });
    }
  }

  // Check for potential issues
  console.log('\n🔍 POTENTIAL ISSUES:');
  
  // Users with signup intent but wrong status
  const usersWithIntentWrongStatus = users.filter(u => 
    u.signupIntent && u.status !== 'VERIFIED_PENDING_PAYMENT'
  );
  if (usersWithIntentWrongStatus.length > 0) {
    console.log('⚠️  Users with signup intent but wrong status:');
    usersWithIntentWrongStatus.forEach(user => {
      console.log(`   - ${user.email}: ${user.status} but has signup intent for ${user.signupIntent?.levelKey}`);
    });
  }

  // Users with membership level but not ACTIVE
  const usersWithLevelWrongStatus = users.filter(u => 
    u.membershipLevel && u.status !== 'ACTIVE'
  );
  if (usersWithLevelWrongStatus.length > 0) {
    console.log('⚠️  Users with membership level but wrong status:');
    usersWithLevelWrongStatus.forEach(user => {
      console.log(`   - ${user.email}: ${user.status} but has level ${user.membershipLevel}`);
    });
  }

  // Users with Stripe customer ID but no membership
  const usersWithStripeNoMembership = users.filter(u => 
    u.stripeCustomerId && !u.membershipLevel && u.status === 'ACTIVE'
  );
  if (usersWithStripeNoMembership.length > 0) {
    console.log('⚠️  Users with Stripe customer ID but no membership level:');
    usersWithStripeNoMembership.forEach(user => {
      console.log(`   - ${user.email}: Has Stripe customer ${user.stripeCustomerId} but no membership level`);
    });
  }
}

async function debugAuthenticationFlows() {
  console.log('\n🔐 3. AUTHENTICATION FLOW DEBUG');
  console.log('🔐 =============================');

  // Check users in different authentication states
  const pendingVerification = await User.find({ status: 'PENDING_VERIFICATION' });
  const verifiedPendingPayment = await User.find({ status: 'VERIFIED_PENDING_PAYMENT' });
  const activeUsers = await User.find({ status: 'ACTIVE' });

  console.log(`⏳ PENDING_VERIFICATION: ${pendingVerification.length} users`);
  console.log(`💳 VERIFIED_PENDING_PAYMENT: ${verifiedPendingPayment.length} users`);
  console.log(`✅ ACTIVE: ${activeUsers.length} users`);

  // Check for users stuck in intermediate states
  if (pendingVerification.length > 0) {
    console.log('\n📧 Users awaiting email verification:');
    pendingVerification.slice(0, 5).forEach(user => {
      const daysSinceCreation = Math.floor((Date.now() - (user as any).createdAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   - ${user.email}: ${daysSinceCreation} days since creation`);
    });
  }

  if (verifiedPendingPayment.length > 0) {
    console.log('\n💳 Users ready for checkout:');
    verifiedPendingPayment.slice(0, 5).forEach(user => {
      if (user.signupIntent) {
        const expiresIn = Math.floor((user.signupIntent.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        console.log(`   - ${user.email}: ${user.signupIntent.levelKey} (expires in ${expiresIn} days)`);
      }
    });
  }

  // Check for expired signup intents
  const expiredIntents = verifiedPendingPayment.filter(user => 
    user.signupIntent && user.signupIntent.expiresAt < new Date()
  );
  if (expiredIntents.length > 0) {
    console.log(`\n⏰ ${expiredIntents.length} users with expired signup intents`);
    expiredIntents.forEach(user => {
      console.log(`   - ${user.email}: ${user.signupIntent?.levelKey} expired ${user.signupIntent?.expiresAt.toISOString()}`);
    });
  }
}

async function debugCheckoutFlows() {
  console.log('\n🛒 4. CHECKOUT FLOW DEBUG');
  console.log('🛒 =======================');

  // Check checkout sessions
  const checkoutSessions = await CheckoutSession.find({}).populate('userId', 'email username status');
  
  console.log(`📝 Total checkout sessions: ${checkoutSessions.length}`);
  
  const sessionsByStatus = checkoutSessions.reduce((acc, session) => {
    acc[session.status] = (acc[session.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Sessions by status:', sessionsByStatus);

  // Check for orphaned sessions
  const orphanedSessions = checkoutSessions.filter(session => !session.userId);
  if (orphanedSessions.length > 0) {
    console.log(`\n⚠️  ${orphanedSessions.length} orphaned checkout sessions (no userId):`);
    orphanedSessions.slice(0, 5).forEach(session => {
      console.log(`   - ${session.stripeSessionId}: ${session.status}`);
    });
  }

  // Check for sessions with wrong user status
  const sessionsWithWrongUserStatus = checkoutSessions.filter(session => 
    session.userId && (session.userId as any).status !== 'ACTIVE' && session.status === 'COMPLETED'
  );
  if (sessionsWithWrongUserStatus.length > 0) {
    console.log(`\n⚠️  ${sessionsWithWrongUserStatus.length} completed sessions with wrong user status:`);
    sessionsWithWrongUserStatus.slice(0, 5).forEach(session => {
      const user = session.userId as any;
      console.log(`   - ${session.stripeSessionId}: User ${user.email} has status ${user.status}`);
    });
  }

  // Check for duplicate sessions
  const sessionIds = checkoutSessions.map(s => s.stripeSessionId);
  const duplicateIds = sessionIds.filter((id, index) => sessionIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.log(`\n⚠️  ${duplicateIds.length} duplicate Stripe session IDs found`);
    duplicateIds.forEach(id => {
      const sessions = checkoutSessions.filter(s => s.stripeSessionId === id);
      console.log(`   - ${id}: ${sessions.length} sessions`);
    });
  }
}

async function debugWebhookProcessing() {
  console.log('\n🔔 5. WEBHOOK PROCESSING DEBUG');
  console.log('🔔 =============================');

  // Get recent webhook events
  const recentEvents = await WebhookEvent.find()
    .sort({ processedAt: -1 })
    .limit(20);

  console.log(`📊 Recent webhook events: ${recentEvents.length}`);

  // Group by event type
  const eventsByType = recentEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📈 Events by type:', eventsByType);

  // Check for failed events
  const failedEvents = await WebhookEvent.find({ status: 'failed' })
    .sort({ processedAt: -1 })
    .limit(10);

  if (failedEvents.length > 0) {
    console.log(`\n❌ ${failedEvents.length} failed webhook events:`);
    failedEvents.forEach(event => {
      console.log(`   - ${event.eventType}: ${event.errorMessage}`);
      console.log(`     Processed: ${event.processedAt?.toISOString()}`);
    });
  }

  // Check for stuck events
  const stuckEvents = await WebhookEvent.find({ 
    status: 'processing',
    processedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 minutes
  });

  if (stuckEvents.length > 0) {
    console.log(`\n⚠️  ${stuckEvents.length} potentially stuck webhook events:`);
    stuckEvents.forEach(event => {
      const minutesAgo = Math.floor((Date.now() - event.processedAt!.getTime()) / (1000 * 60));
      console.log(`   - ${event.eventType}: Stuck for ${minutesAgo} minutes`);
    });
  }

  // Check for duplicate events
  const eventIds = recentEvents.map(e => e.eventId);
  const duplicateEventIds = eventIds.filter((id, index) => eventIds.indexOf(id) !== index);
  if (duplicateEventIds.length > 0) {
    console.log(`\n⚠️  ${duplicateEventIds.length} duplicate webhook event IDs found`);
    duplicateEventIds.forEach(id => {
      const events = recentEvents.filter(e => e.eventId === id);
      console.log(`   - ${id}: ${events.length} events`);
    });
  }

  // Check webhook processing performance
  const processingTimes: number[] = [];
  recentEvents.forEach(event => {
    if (event.processedAt && event.claimedAt) {
      const processingTime = event.processedAt.getTime() - event.claimedAt.getTime();
      processingTimes.push(processingTime);
    }
  });

  if (processingTimes.length > 0) {
    const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const maxTime = Math.max(...processingTimes);
    const minTime = Math.min(...processingTimes);
    console.log(`\n⏱️  Webhook processing performance:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log(`   Min: ${minTime}ms`);
  }
}

async function debugSubscriptionsAndOrders() {
  console.log('\n💳 6. SUBSCRIPTION & ORDER DEBUG');
  console.log('💳 ==============================');

  // Check subscriptions
  const subscriptions = await Subscription.find({}).populate('userId', 'email username status');
  console.log(`📊 Total subscriptions: ${subscriptions.length}`);

  const subscriptionsByStatus = subscriptions.reduce((acc, sub) => {
    acc[sub.status] = (acc[sub.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const subscriptionsByKind = subscriptions.reduce((acc, sub) => {
    acc[sub.kind] = (acc[sub.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📈 Subscriptions by status:', subscriptionsByStatus);
  console.log('🎯 Subscriptions by kind:', subscriptionsByKind);

  // Check for orphaned subscriptions
  const orphanedSubscriptions = subscriptions.filter(sub => !sub.userId);
  if (orphanedSubscriptions.length > 0) {
    console.log(`\n⚠️  ${orphanedSubscriptions.length} orphaned subscriptions (no userId):`);
    orphanedSubscriptions.slice(0, 5).forEach(sub => {
      console.log(`   - ${sub._id}: ${sub.kind} - ${sub.status}`);
    });
  }

  // Check for subscriptions with wrong user status
  const subscriptionsWithWrongUserStatus = subscriptions.filter(sub => 
    sub.userId && (sub.userId as any).status !== 'ACTIVE' && sub.status === 'ACTIVE'
  );
  if (subscriptionsWithWrongUserStatus.length > 0) {
    console.log(`\n⚠️  ${subscriptionsWithWrongUserStatus.length} active subscriptions with wrong user status:`);
    subscriptionsWithWrongUserStatus.slice(0, 5).forEach(sub => {
      const user = sub.userId as any;
      console.log(`   - ${sub._id}: User ${user.email} has status ${user.status}`);
    });
  }

  // Check orders
  const orders = await Order.find({}).populate('userId', 'email username status');
  console.log(`\n🧾 Total orders: ${orders.length}`);

  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📈 Orders by status:', ordersByStatus);

  // Check for orphaned orders
  const orphanedOrders = orders.filter(order => !order.userId);
  if (orphanedOrders.length > 0) {
    console.log(`\n⚠️  ${orphanedOrders.length} orphaned orders (no userId):`);
    orphanedOrders.slice(0, 5).forEach(order => {
      console.log(`   - ${order._id}: ${order.status} - ${order.totalCents} cents`);
    });
  }

  // Check for orders with wrong user status
  const ordersWithWrongUserStatus = orders.filter(order => 
    order.userId && (order.userId as any).status !== 'ACTIVE' && order.status === 'COMPLETED'
  );
  if (ordersWithWrongUserStatus.length > 0) {
    console.log(`\n⚠️  ${ordersWithWrongUserStatus.length} completed orders with wrong user status:`);
    ordersWithWrongUserStatus.slice(0, 5).forEach(order => {
      const user = order.userId as any;
      console.log(`   - ${order._id}: User ${user.email} has status ${user.status}`);
    });
  }

  // Check for missing subscription links
  const ordersWithoutSubscription = orders.filter(order => !order.subscriptionId);
  if (ordersWithoutSubscription.length > 0) {
    console.log(`\n⚠️  ${ordersWithoutSubscription.length} orders without subscription links:`);
    ordersWithoutSubscription.slice(0, 5).forEach(order => {
      console.log(`   - ${order._id}: ${order.status} - ${order.totalCents} cents`);
    });
  }
}

async function debugEdgeCases() {
  console.log('\n⚠️  7. EDGE CASES & ERROR SCENARIOS');
  console.log('⚠️  ===================================');

  // Check for users with multiple active subscriptions
  const usersWithMultipleSubs = await User.aggregate([
    { $match: { status: 'ACTIVE' } },
    { $lookup: { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscriptions' } },
    { $match: { 'subscriptions.status': 'ACTIVE' } },
    { $group: { _id: '$_id', email: { $first: '$email' }, subCount: { $sum: 1 } } },
    { $match: { subCount: { $gt: 1 } } }
  ]);

  if (usersWithMultipleSubs.length > 0) {
    console.log(`\n⚠️  ${usersWithMultipleSubs.length} users with multiple active subscriptions:`);
    usersWithMultipleSubs.forEach(user => {
      console.log(`   - ${user.email}: ${user.subCount} active subscriptions`);
    });
  }

  // Check for users with conflicting statuses
  const usersWithConflictingStatus = await User.find({
    $or: [
      { status: 'ACTIVE', membershipLevel: { $exists: false } },
      { status: 'VERIFIED_PENDING_PAYMENT', signupIntent: { $exists: false } },
      { status: 'PENDING_VERIFICATION', emailVerified: true }
    ]
  });

  if (usersWithConflictingStatus.length > 0) {
    console.log(`\n⚠️  ${usersWithConflictingStatus.length} users with conflicting statuses:`);
    usersWithConflictingStatus.forEach(user => {
      console.log(`   - ${user.email}: ${user.status} - Level: ${user.membershipLevel || 'N/A'}, Intent: ${user.signupIntent ? 'Yes' : 'No'}, Verified: ${user.emailVerified || 'No'}`);
    });
  }

  // Check for expired but not cleaned up data
  const now = new Date();
  const expiredSignupIntents = await User.find({
    'signupIntent.expiresAt': { $lt: now },
    status: 'VERIFIED_PENDING_PAYMENT'
  });

  if (expiredSignupIntents.length > 0) {
    console.log(`\n⏰ ${expiredSignupIntents.length} users with expired signup intents:`);
    expiredSignupIntents.slice(0, 5).forEach(user => {
      const daysExpired = Math.floor((now.getTime() - user.signupIntent!.expiresAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   - ${user.email}: Expired ${daysExpired} days ago`);
    });
  }

  // Check for orphaned Stripe data
  const usersWithStripeNoSub = await User.find({
    stripeCustomerId: { $exists: true },
    status: 'ACTIVE'
  });

  const orphanedStripeUsers = [];
  for (const user of usersWithStripeNoSub) {
    const subscription = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' });
    if (!subscription) {
      orphanedStripeUsers.push(user);
    }
  }

  if (orphanedStripeUsers.length > 0) {
    console.log(`\n⚠️  ${orphanedStripeUsers.length} users with Stripe customer ID but no active subscription:`);
    orphanedStripeUsers.slice(0, 5).forEach(user => {
      console.log(`   - ${user.email}: Stripe customer ${user.stripeCustomerId} but no subscription`);
    });
  }

  // Check for data consistency issues
  const inconsistentData = await User.aggregate([
    { $lookup: { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscriptions' } },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'userId', as: 'orders' } },
    {
      $addFields: {
        activeSubs: { $filter: { input: '$subscriptions', cond: { $eq: ['$$this.status', 'ACTIVE'] } } },
        completedOrders: { $filter: { input: '$orders', cond: { $eq: ['$$this.status', 'COMPLETED'] } } }
      }
    },
    {
      $match: {
        $or: [
          { status: 'ACTIVE', activeSubs: { $size: 0 } },
          { status: 'VERIFIED_PENDING_PAYMENT', completedOrders: { $gt: [{ $size: '$completedOrders' }, 0] } }
        ]
      }
    }
  ]);

  if (inconsistentData.length > 0) {
    console.log(`\n⚠️  ${inconsistentData.length} users with inconsistent data:`);
    inconsistentData.slice(0, 5).forEach(user => {
      console.log(`   - ${user.email}: Status ${user.status}, Active subs: ${user.activeSubs.length}, Completed orders: ${user.completedOrders.length}`);
    });
  }
}

async function debugStripeIntegration() {
  console.log('\n🔗 8. STRIPE INTEGRATION DEBUG');
  console.log('🔗 =============================');

  try {
    // Test Stripe connection
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Stripe connected successfully - Account: ${account.id}`);

    // Check webhook endpoints
    const webhooks = await stripe.webhookEndpoints.list();
    console.log(`🔔 Webhook endpoints: ${webhooks.data.length}`);

    webhooks.data.forEach(webhook => {
      console.log(`   - ${webhook.url} (${webhook.status})`);
      if (webhook.status === 'disabled') {
        console.log(`     ⚠️  Disabled webhook endpoint`);
      }
    });

    // Check for test vs live mode
    if (process.env.STRIPE_SECRET_KEY?.includes('sk_test_')) {
      console.log('🧪 Running in Stripe TEST mode');
    } else if (process.env.STRIPE_SECRET_KEY?.includes('sk_live_')) {
      console.log('🚀 Running in Stripe LIVE mode');
    } else {
      console.log('❓ Stripe mode unclear');
    }

  } catch (error) {
    console.error('❌ Stripe integration error:', error);
  }

  // Check users with Stripe customer IDs
  const usersWithStripe = await User.find({ stripeCustomerId: { $exists: true } });
  console.log(`\n👥 Users with Stripe customer IDs: ${usersWithStripe.length}`);

  // Verify Stripe customers still exist
  const invalidStripeCustomers = [];
  for (const user of usersWithStripe.slice(0, 10)) { // Check first 10 to avoid rate limits
    try {
      await stripe.customers.retrieve(user.stripeCustomerId!);
    } catch (error) {
      invalidStripeCustomers.push(user);
    }
  }

  if (invalidStripeCustomers.length > 0) {
    console.log(`\n⚠️  ${invalidStripeCustomers.length} users with invalid Stripe customer IDs:`);
    invalidStripeCustomers.forEach(user => {
      console.log(`   - ${user.email}: Invalid customer ID ${user.stripeCustomerId}`);
    });
  }

  // Check membership levels with Stripe price IDs
  const membershipLevels = await MembershipLevel.find({ stripePriceId: { $exists: true, $ne: '' } });
  console.log(`\n🏷️  Membership levels with Stripe price IDs: ${membershipLevels.length}`);

  // Verify Stripe prices still exist
  const invalidPrices = [];
  for (const level of membershipLevels.slice(0, 10)) { // Check first 10 to avoid rate limits
    try {
      await stripe.prices.retrieve(level.stripePriceId!);
    } catch (error) {
      invalidPrices.push(level);
    }
  }

  if (invalidPrices.length > 0) {
    console.log(`\n⚠️  ${invalidPrices.length} membership levels with invalid Stripe price IDs:`);
    invalidPrices.forEach(level => {
      console.log(`   - ${level.key}: Invalid price ID ${level.stripePriceId}`);
    });
  }
}

async function checkDataConsistency() {
  console.log('\n🔍 9. DATA CONSISTENCY CHECKS');
  console.log('🔍 ===========================');

  // Check for orphaned data
  const orphanedCheckoutSessions = await CheckoutSession.countDocuments({ userId: { $exists: false } });
  const orphanedSubscriptions = await Subscription.countDocuments({ userId: { $exists: false } });
  const orphanedOrders = await Order.countDocuments({ userId: { $exists: false } });

  console.log(`📊 Orphaned data:`);
  console.log(`   Checkout sessions: ${orphanedCheckoutSessions}`);
  console.log(`   Subscriptions: ${orphanedSubscriptions}`);
  console.log(`   Orders: ${orphanedOrders}`);

  // Check for missing required fields
  const usersWithoutEmail = await User.countDocuments({ email: { $exists: false } });
  const usersWithoutUsername = await User.countDocuments({ username: { $exists: false } });
  const usersWithoutName = await User.countDocuments({ 'name.first': { $exists: false } });

  console.log(`📊 Missing required fields:`);
  console.log(`   Users without email: ${usersWithoutEmail}`);
  console.log(`   Users without username: ${usersWithoutUsername}`);
  console.log(`   Users without name: ${usersWithoutName}`);

  // Check for duplicate emails
  const duplicateEmails = await User.aggregate([
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (duplicateEmails.length > 0) {
    console.log(`\n⚠️  ${duplicateEmails.length} duplicate email addresses found:`);
    duplicateEmails.forEach(dup => {
      console.log(`   - ${dup._id}: ${dup.count} users`);
    });
  }

  // Check for duplicate usernames
  const duplicateUsernames = await User.aggregate([
    { $group: { _id: '$username', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (duplicateUsernames.length > 0) {
    console.log(`\n⚠️  ${duplicateUsernames.length} duplicate usernames found:`);
    duplicateUsernames.forEach(dup => {
      console.log(`   - ${dup._id}: ${dup.count} users`);
    });
  }

  // Check for users with invalid status transitions
  const invalidStatusTransitions = await User.find({
    $or: [
      { status: 'ACTIVE', membershipLevel: { $exists: false } },
      { status: 'VERIFIED_PENDING_PAYMENT', signupIntent: { $exists: false } },
      { status: 'PENDING_VERIFICATION', emailVerified: true }
    ]
  });

  if (invalidStatusTransitions.length > 0) {
    console.log(`\n⚠️  ${invalidStatusTransitions.length} users with invalid status transitions:`);
    invalidStatusTransitions.slice(0, 5).forEach(user => {
      console.log(`   - ${user.email}: ${user.status} - Level: ${user.membershipLevel || 'N/A'}, Intent: ${user.signupIntent ? 'Yes' : 'No'}, Verified: ${user.emailVerified || 'No'}`);
    });
  }

  // Check for subscriptions without proper links
  const subscriptionsWithoutUser = await Subscription.countDocuments({ userId: { $exists: false } });
  const subscriptionsWithoutLevel = await Subscription.countDocuments({ levelId: { $exists: false } });

  console.log(`📊 Subscriptions with missing links:`);
  console.log(`   Without user: ${subscriptionsWithoutUser}`);
  console.log(`   Without level: ${subscriptionsWithoutLevel}`);

  // Check for orders without proper links
  const ordersWithoutUser = await Order.countDocuments({ userId: { $exists: false } });
  const ordersWithoutSubscription = await Order.countDocuments({ subscriptionId: { $exists: false } });

  console.log(`📊 Orders with missing links:`);
  console.log(`   Without user: ${ordersWithoutUser}`);
  console.log(`   Without subscription: ${ordersWithoutSubscription}`);

  // Summary
  const totalIssues = orphanedCheckoutSessions + orphanedSubscriptions + orphanedOrders + 
                     usersWithoutEmail + usersWithoutUsername + usersWithoutName +
                     duplicateEmails.length + duplicateUsernames.length + 
                     invalidStatusTransitions.length + subscriptionsWithoutUser + 
                     subscriptionsWithoutLevel + ordersWithoutUser + ordersWithoutSubscription;

  if (totalIssues === 0) {
    console.log('\n✅ No data consistency issues found!');
  } else {
    console.log(`\n⚠️  Total data consistency issues: ${totalIssues}`);
  }
}

debugWebhook();
