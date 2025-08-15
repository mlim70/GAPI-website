import Stripe from 'stripe';
import mongoose from 'mongoose';
import PendingUser from '../../models/pendingUser.model';
import User from '../../models/user.model';
import MembershipLevel from '../../models/membershipLevel.model';
import Subscription from '../../models/subscription.model';
import Order from '../../models/order.model';
import { stripe } from '../../lib/stripe';

/**
 * Finalizes a Stripe checkout session by creating/updating user accounts and subscriptions.
 * 
 * IMPORTANT: This function ensures only one active subscription per user by:
 * 1. Resolving user (existing or new) BEFORE any transactions
 * 2. Handling subscription changes:
 *    - Switching to one-time purchase: cancels existing subscriptions
 *    - Switching to free: marks existing subscriptions as cancelled
 * 3. Running a short, focused database transaction for data consistency
 * 4. Creating the new subscription/order
 * 
 * FUTURE IMPROVEMENT: For even stronger guarantees, consider implementing an "outbox" pattern:
 * - Enqueue "cancel at Stripe" jobs in a separate table after successful commit
 * - Process outbox jobs asynchronously with retry logic
 * - Ensures Stripe operations happen exactly once, even on process crashes
 */
export async function finalizeCheckoutFromSession(session: Stripe.Checkout.Session) {
  console.log('🔍 Finalizing checkout session:', { 
    sessionId: session.id, 
    metadata: session.metadata,
    paymentStatus: session.payment_status,
    sessionStatus: session.status
  });
  
  // 1) Figure out flow (new vs existing)
  const { pendingUserId, userId: existingUserId, levelKey } = session.metadata || {};
  console.log('🔍 Session metadata:', { pendingUserId, existingUserId, levelKey });
  
  if (!pendingUserId && !existingUserId) {
    console.error('❌ No user metadata on session');
    throw new Error('No user metadata on session');
  }

  // 2) Pull level (required)
  console.log('🔍 Looking up membership level:', levelKey);
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level) {
    console.error('❌ Invalid membership level:', levelKey);
    throw new Error(`Invalid membership level: ${levelKey}`);
  }
  console.log('✅ Found membership level:', { levelId: level._id, key: level.key });

  // 3) Derive flags
  const isRecurring = !!session.subscription;
  const isFree = (session.amount_total ?? 0) === 0 || session.payment_status === 'no_payment_required';
  const kind: 'ONE_TIME' | 'RECURRING' | 'FREE' = isRecurring ? 'RECURRING' : (isFree ? 'FREE' : 'ONE_TIME');
  const gateway: 'stripe' | 'internal' = isFree ? 'internal' : 'stripe';
  
  console.log('🔍 Session flags:', { 
    isRecurring, 
    isFree, 
    kind, 
    gateway,
    subscriptionType: typeof session.subscription,
    subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  });

  let nextBillDate: Date | null = null;
  if (isRecurring && typeof session.subscription === 'string') {
    try {
      const s = await stripe.subscriptions.retrieve(session.subscription, { expand: ['latest_invoice'] });
      nextBillDate = new Date(s.current_period_end * 1000);
    } catch { /* ok */ }
  }

  // 4) Resolve user before transaction (avoids long-running txn)
  let user;
  let pendingIdToDelete: mongoose.Types.ObjectId | undefined;
  if (existingUserId) {
    console.log('🔍 Looking up existing user:', existingUserId);
    user = await User.findById(existingUserId);
    if (!user) {
      console.error('❌ Existing user not found:', existingUserId);
      throw new Error('Existing user not found');
    }
    console.log('✅ Found existing user:', { userId: user._id, email: user.email, username: user.username });
  } else {
    console.log('🔍 Looking up pending user:', pendingUserId);
    let pending = await PendingUser.findById(pendingUserId);

    if (!pending) {
      // ⛳️ idempotent fallback: find the user by the email Stripe gave us
      console.log('⚠️ Pending user not found, attempting idempotent fallback by email');
      const emailFromStripe = session.customer_details?.email || session.metadata?.email;
      if (emailFromStripe) {
        console.log('🔍 Attempting to resolve user by Stripe email:', emailFromStripe);
        user = await User.findOne({ email: emailFromStripe });
        if (user) {
          console.log('✅ Successfully resolved user by Stripe email:', { userId: user._id, email: user.email });
        } else {
          console.log('❌ No user found with Stripe email:', emailFromStripe);
        }
      }
      if (!user) {
        console.error('❌ Pending user not found and no user could be resolved by email');
        throw new Error('Pending user not found and no user could be resolved by email');
      }
    } else {
      // normal new-user flow
      console.log('✅ Found pending user, proceeding with normal flow');
      user = await User.findOne({
        $or: [{ email: pending.email }, { username: pending.username }]
      });

      if (!user) {
        user = await User.create({
          email: pending.email,
          username: pending.username,
          passwordHash: pending.passwordHash,
          name: pending.name,
          membershipLevel: pending.levelKey,
          emailVerified: true,
          verifiedAt: new Date()
        });
      }

      // Remember pending user ID to delete after successful transaction
      pendingIdToDelete = pending._id;
    }
  }

  // 5) Handle subscription changes intelligently
  console.log('🔍 Looking for active subscriptions to handle for user:', user._id);
  
  // Check all subscriptions for this user to see what we're working with
  const allSubs = await Subscription.find({ userId: user._id });
  console.log('🔍 All subscriptions for user:', allSubs.map(sub => ({
    id: sub._id,
    gateway: sub.gateway,
    gatewaySubId: sub.gatewaySubId,
    status: sub.status,
    kind: sub.kind
  })));
  
  const active = await Subscription.find({ userId: user._id, status: 'ACTIVE' });
  console.log('🔍 Found active subscriptions:', active.length);
  
  if (active.length > 0) {
    console.log('🔍 Active subscription details:', active.map(sub => ({
      id: sub._id,
      gateway: sub.gateway,
      gatewaySubId: sub.gatewaySubId,
      status: sub.status,
      kind: sub.kind
    })));
  }
  
  // Determine if we're switching to a one-time purchase
  const isSwitchingToOneTime = !isRecurring;
  
  console.log('🔍 Subscription change analysis:', {
    isRecurring,
    isSwitchingToOneTime,
    newLevelKey: level.key,
    newLevelStripePriceId: level.stripePriceId
  });
  
  for (const sub of active) {
    if (sub.gateway === 'stripe' && sub.gatewaySubId) {
      if (isSwitchingToOneTime) {
        // Switching to one-time purchase: cancel the subscription
        try {
          console.log(`🔄 Cancelling Stripe subscription (switching to one-time): ${sub.gatewaySubId}`);
          const cancelResult = await stripe.subscriptions.cancel(sub.gatewaySubId);
          console.log(`✅ Successfully cancelled Stripe subscription: ${sub.gatewaySubId}`, {
            stripeStatus: cancelResult.status,
            cancelledAt: cancelResult.canceled_at
          });
          
          // Immediately mark as cancelled in database to prevent webhook race conditions
          await Subscription.updateOne(
            { _id: sub._id },
            { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
          );
          console.log(`✅ Immediately marked subscription as cancelled in database: ${sub._id}`);
        } catch (e) {
          console.error(`❌ Failed to cancel Stripe subscription ${sub.gatewaySubId}:`, e);
          // Continue with other cancellations - don't fail the entire process
        }
      } else {
        // Any other case (defensive): mark stale ACTIVE rows as cancelled in DB
        console.log(`⏭️ Marking free subscription as cancelled:`, { 
          gateway: sub.gateway, 
          gatewaySubId: sub.gatewaySubId,
          status: sub.status 
        });
        await Subscription.updateOne(
          { _id: sub._id },
          { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } }
        );
      }
    } else {
      console.log(`⏭️ Skipping non-Stripe subscription:`, { 
        gateway: sub.gateway, 
        gatewaySubId: sub.gatewaySubId,
        status: sub.status 
      });
    }
  }
  
  // Log summary of subscription handling
  const cancelledCount = await Subscription.countDocuments({ userId: user._id, status: 'CANCELLED' });
  console.log('📊 Subscription handling summary:', {
    totalSubscriptions: allSubs.length,
    activeSubscriptions: active.length,
    cancelledSubscriptions: cancelledCount,
    action: isSwitchingToOneTime ? 'cancelled_for_one_time' : 'marked_cancelled'
  });

  // 6) Run short, focused database transaction
  console.log('🔍 Starting database transaction for user:', user._id);
  const msession = await mongoose.startSession();
  try {
    await msession.withTransaction(async () => {
      console.log('🔍 Marking old subscriptions as cancelled...');
      // Mark old subscriptions as cancelled
      const cancelledResult = await Subscription.updateMany(
        { userId: user._id, status: 'ACTIVE' },
        { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } },
        { session: msession }
      );
      console.log('✅ Cancelled old subscriptions:', cancelledResult.modifiedCount);
      
      // Verify the cancellation worked
      const remainingActive = await Subscription.find(
        { userId: user._id, status: 'ACTIVE' },
        null,
        { session: msession }
      );
      console.log('🔍 Remaining active subscriptions after cancellation:', remainingActive.length);
      if (remainingActive.length > 0) {
        console.log('⚠️ WARNING: Some subscriptions are still active:', remainingActive.map(sub => ({
          id: sub._id,
          gateway: sub.gateway,
          gatewaySubId: sub.gatewaySubId,
          status: sub.status
        })));
        
        // Force cancel any remaining active subscriptions to prevent conflicts
        console.log('🔧 Force cancelling remaining active subscriptions...');
        await Subscription.updateMany(
          { userId: user._id, status: 'ACTIVE' },
          { $set: { status: 'CANCELLED', endDate: new Date(), cancelDate: new Date() } },
          { session: msession }
        );
        console.log('✅ Force cancelled remaining active subscriptions');
      }

      // Upsert new subscription idempotently
      console.log('🔍 Creating new subscription with kind:', kind);
      let subscription;
      if (isRecurring && typeof session.subscription === 'string') {
        console.log('🔍 Creating RECURRING subscription with gatewaySubId:', session.subscription);
        subscription = await Subscription.findOneAndUpdate(
          { gatewaySubId: session.subscription },
          {
            $set: {
              userId: user._id,
              levelId: level._id,
              kind: 'RECURRING',
              autoRenews: true,
              gateway: 'stripe',
              status: 'ACTIVE',
              startDate: new Date(),
              nextBillDate,
              endDate: null,
              cancelDate: null
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session: msession }
        );
        console.log('✅ Created/updated RECURRING subscription:', subscription._id);
      } else {
        console.log('🔍 Creating ONE_TIME subscription');
        const [created] = await Subscription.create([{
          userId: user._id,
          levelId: level._id,
          kind,
          autoRenews: false,
          gateway,
          gatewaySubId: null,
          status: 'ACTIVE',
          startDate: new Date(),
          nextBillDate: null,
          endDate: null,
          cancelDate: null
        }], { session: msession });
        subscription = created;
        console.log('✅ Created ONE_TIME subscription:', subscription._id);
      }

      // Upsert order idempotently by gatewayPaymentId
      let gatewayPaymentId: string;
      if (kind === 'FREE') {
        gatewayPaymentId = `free_${subscription._id}`;
      } else if (session.payment_intent) {
        gatewayPaymentId = session.payment_intent as string;
      } else if (session.subscription) {
        // Extract subscription ID from subscription object or string
        gatewayPaymentId = typeof session.subscription === 'string' 
          ? session.subscription 
          : session.subscription.id;
      } else {
        gatewayPaymentId = session.id;
      }

      console.log('🔍 Creating order with gatewayPaymentId:', gatewayPaymentId);

      await Order.updateOne(
        { gatewayPaymentId },
        {
          $setOnInsert: {
            userId: user._id,
            subscriptionId: subscription._id,
            membershipLevelId: level._id,
            totalCents: session.amount_total || 0,
            currency: session.currency || 'usd',
            billing: {
              name: session.customer_details?.name || (user.name?.first ? `${user.name.first} ${user.name.last ?? ''}`.trim() : user.username || user.email),
              email: session.customer_details?.email || user.email
            },
            status: 'COMPLETED',
            paidAt: new Date()
          }
        },
        { upsert: true, session: msession }
      );

      // Update user's fast cache
      console.log('🔍 Updating user membership level cache to:', level.key);
      await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } }, { session: msession });
      console.log('✅ User membership level cache updated');
    });
    console.log('✅ Database transaction completed successfully');
  } finally {
    msession.endSession();
  }

  // Delete pending user after successful transaction to avoid double-processing
  if (pendingIdToDelete) {
    console.log('🔍 Deleting pending user after successful transaction:', pendingIdToDelete);
    await PendingUser.deleteOne({ _id: pendingIdToDelete });
    console.log('✅ Pending user deleted successfully');
  }

  console.log('🔍 Fetching fresh user data...');
  const fresh = await User.findById(user._id).lean();
  console.log('✅ Finalization completed successfully for user:', fresh?._id);
  return { user: fresh! };
}
