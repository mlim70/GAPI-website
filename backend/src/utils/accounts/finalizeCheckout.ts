import Stripe from 'stripe';
import mongoose from 'mongoose';
import PendingUser from '../../models/pendingUser.model';
import User from '../../models/user.model';
import MembershipLevel from '../../models/membershipLevel.model';
import Subscription from '../../models/subscription.model';
import Order from '../../models/order.model';
import { stripe } from '../../lib/stripe';

export async function finalizeCheckoutFromSession(session: Stripe.Checkout.Session) {
  // 1) Figure out flow (new vs existing)
  const { pendingUserId, userId: existingUserId, levelKey } = session.metadata || {};
  if (!pendingUserId && !existingUserId) throw new Error('No user metadata on session');

  // 2) Pull level (required)
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level) throw new Error(`Invalid membership level: ${levelKey}`);

  // 3) Derive flags
  const isRecurring = !!session.subscription;
  const isFree = (session.amount_total ?? 0) === 0 || session.payment_status === 'no_payment_required';
  const kind: 'ONE_TIME' | 'RECURRING' | 'FREE' = isRecurring ? 'RECURRING' : (isFree ? 'FREE' : 'ONE_TIME');
  const gateway: 'stripe' | 'internal' = isFree ? 'internal' : 'stripe';

  let nextBillDate: Date | null = null;
  if (isRecurring && typeof session.subscription === 'string') {
    try {
      const s = await stripe.subscriptions.retrieve(session.subscription, { expand: ['latest_invoice'] });
      nextBillDate = new Date(s.current_period_end * 1000);
    } catch { /* ok */ }
  }

  // 4) Run the heavy path atomically
  const msession = await mongoose.startSession();
  try {
    let user;

    await msession.withTransaction(async () => {
      if (existingUserId) {
        user = await User.findById(existingUserId).session(msession);
        if (!user) throw new Error('Existing user not found');
      } else {
        const pending = await PendingUser.findById(pendingUserId).session(msession);
        if (!pending) throw new Error('Pending user not found');

        // find-or-create user by email/username (idempotent)
        user = await User.findOne({
          $or: [{ email: pending.email }, { username: pending.username }]
        }).session(msession);

        if (!user) {
          const [created] = await User.create([{
            email: pending.email,
            username: pending.username,
            passwordHash: pending.passwordHash,
            name: pending.name,
            membershipLevel: pending.levelKey,
            emailVerified: true,
            verifiedAt: new Date()
          }], { session: msession });
          user = created;
        }

        // drop pending to avoid double-processing
        await PendingUser.deleteOne({ _id: pending._id }).session(msession);
      }

      // invariant: one ACTIVE sub per user → cancel others
      await Subscription.updateMany(
        { userId: user._id, status: 'ACTIVE' },
        { $set: { status: 'CANCELLED', endDate: new Date() } },
        { session: msession }
      );

      // upsert new subscription idempotently
      let subscription;
      if (isRecurring && typeof session.subscription === 'string') {
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
      } else {
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
      }

      // upsert order idempotently by gatewayPaymentId
      let gatewayPaymentId: string =
        (session.payment_intent as string) ||
        (session.subscription as string) ||
        session.id;
      if (kind === 'FREE') gatewayPaymentId = `free_${subscription._id}`;

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

      // update user's fast cache
      await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } }, { session: msession });
    });

    const fresh = await User.findById(user!._id).lean();
    return { user: fresh! };
  } finally {
    msession.endSession();
  }
}
