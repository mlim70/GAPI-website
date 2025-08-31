//scripts/importLegacyMembers.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../backend/src/models/user.model';
import Subscription from '../backend/src/models/subscription.model';
import MembershipLevel from '../backend/src/models/membershipLevel.model';
import { normalizeEmail } from '../backend/src/utils/email/emailUtils';
import { stripe } from '../backend/src/lib/stripe/client';
import { logger } from '../backend/src/utils/general/logger';

type Row = {
  email: string;
  firstName?: string; lastName?: string; username?: string;
  planRaw?: string; levelKeyGuess?: string;
  type: 'lifetime' | 'recurring' | 'unknown';
  startDate?: string | null;
  endDate?: string | null; // legacy next_payment_date (preferred) or expires
  status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';
};

const KEY_BY_PLAN: Record<string, string> = {
  'Lifetime': 'LIFETIME',
  'Associate Life': 'ASSOCIATE_LIFE',
  'Student': 'STUDENT',
  'Annual': 'ANNUAL',
  'Associate': 'ASSOCIATE',
};

// Limits & knobs
const MAX_TRIAL_SECONDS = 730 * 24 * 60 * 60; // Stripe's max trial window (730 days)
const GRACE_DAYS = 30;

// ---------- helpers ----------
function parseDate(s?: string | null) {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

async function ensureUsername(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/^-+/, '');
  let candidate = clean || `user${Math.floor(Math.random()*1e6)}`;
  let n = 1;
  while (await User.exists({ username: candidate })) {
    candidate = `${clean}${n++}`;
  }
  return candidate;
}

async function ensureStripeCustomerId(user: any) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const cust = await stripe.customers.create({
    email: user.email,
    name: [user.name?.first, user.name?.last].filter(Boolean).join(' ') || undefined,
    metadata: { legacy: 'true', legacy_source: 'wordpress' },
  });
  await User.updateOne({ _id: user._id }, { $set: { stripeCustomerId: cust.id } });
  return cust.id;
}

function computeTrialEnd(now: Date, legacyEnd?: Date) {
  if (!legacyEnd || isNaN(legacyEnd.getTime())) return { trialEndUnix: null, usedGrace: false, tooLong: false };

  const threshold = new Date(now.getTime() + GRACE_DAYS*24*60*60*1000);
  const desired = (legacyEnd > now && legacyEnd <= threshold) ? threshold : legacyEnd; // grace if within 30d
  const maxTrialEnd = new Date(now.getTime() + MAX_TRIAL_SECONDS*1000);

  if (desired > maxTrialEnd) {
    return { trialEndUnix: null, usedGrace: false, tooLong: true };
  }
  const unix = Math.floor(desired.getTime() / 1000);
  return { trialEndUnix: unix, usedGrace: desired.getTime() === threshold.getTime(), tooLong: false };
}

async function findExistingStripeSub(customerId: string, priceId: string) {
  // Small datasets—listing is fine; guard duplicates
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  return list.data.find(sub =>
    sub.items.data.some(it => it.price?.id === priceId) &&
    sub.status !== 'canceled'
  );
}

function mapStripeStatus(s: string): 'ACTIVE' | 'CANCELLED' | 'EXPIRED' {
  // Treat trialing/active/past_due/incomplete as ACTIVE for access. You can refine later.
  if (['active', 'trialing', 'past_due', 'incomplete'].includes(s)) return 'ACTIVE';
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(s)) return 'CANCELLED';
  return 'ACTIVE';
}

// ---------- main ----------
async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const rows: Row[] = JSON.parse(
    fs.readFileSync(path.resolve('./scripts/data/legacy_members.normalized.v2.json'), 'utf8')
  );

  let createdUsers = 0, updatedUsers = 0, upsertedSubs = 0, createdStripeSubs = 0, fellBackInternal = 0;

  const now = new Date();

  for (const r of rows) {
    if (!r?.email) continue;

    // Normalize & validate email
    const norm = normalizeEmail(r.email);
    if (!norm) { logger?.warn?.(`Skipping invalid email: ${r.email}`); continue; }
    const email = norm;

    const planName = (r.planRaw || '').trim();
    const levelKey = r.levelKeyGuess || KEY_BY_PLAN[planName] || null;
    if (!levelKey) { logger?.warn?.(`Skipping (no level key): "${planName}" for ${email}`); continue; }

    const level = await MembershipLevel.findOne({ key: levelKey, status: 'ACTIVE' });
    if (!level) { logger?.warn?.(`Missing MembershipLevel ${levelKey}; skipping ${email}`); continue; }

    // ----- USER UPSERT (username, name, temp password) -----
    const first = (r.firstName || '').trim();
    const last  = (r.lastName  || '').trim();
    const tmpPassword = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(tmpPassword, 12);
    const desired = (r.username && r.username.trim()) || email.split('@')[0];
    const username = await ensureUsername(desired);

    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          username,
          name: { first: first || 'Member', last: last || 'Legacy' },
          passwordHash,
          status: 'ACTIVE',
          createdAt: new Date(),
        },
        $set: { 
          status: 'ACTIVE',
          updatedAt: new Date() 
        }
      },
      { upsert: true, new: true }
    );
    if (user.createdAt.getTime() === user.updatedAt.getTime()) createdUsers++; else updatedUsers++;

    // Stripe Customer (for later PMs and auto-renew)
    const customerId = await ensureStripeCustomerId(user);

    // ----- LIFETIME ⇒ internal ONE_TIME (permanent) -----
    if (r.type === 'lifetime') {
      const filter = { userId: user._id, levelId: level._id, gateway: 'internal', kind: 'ONE_TIME' } as const;
      await Subscription.updateOne(
        filter,
        {
          $set: {
            planName,
            autoRenews: false,
            stripeSubscriptionId: null,
            status: 'ACTIVE',
            startDate: parseDate(r.startDate) || user.createdAt,
            endDate: null,
            nextBillDate: null,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      // Lifetime precedence for cache
      await User.updateOne({ _id: user._id }, { $set: { membershipLevel: 'LIFETIME' } });
      upsertedSubs++;
      continue;
    }

    // ----- RECURRING ⇒ Stripe subscription with trial_end -----
    if (r.type === 'recurring') {
      const legacyEnd = parseDate(r.endDate); // from next_payment_date/expires in the normalized file
      const { trialEndUnix, usedGrace, tooLong } = computeTrialEnd(now, legacyEnd);

      if (tooLong) {
        // If the trial would exceed Stripe's 730 day limit, fall back to an internal row and handle later.
        const filter = { userId: user._id, levelId: level._id, gateway: 'internal', kind: 'RECURRING' } as const;
        const status = legacyEnd && legacyEnd > now ? 'ACTIVE' : 'EXPIRED';
        await Subscription.updateOne(
          filter,
          {
            $set: {
              planName,
              autoRenews: false,
              stripeSubscriptionId: null,
              status,
              startDate: parseDate(r.startDate) || user.createdAt,
              endDate: legacyEnd || null,
              nextBillDate: legacyEnd || null,
              cancelReason: 'fallback_internal_trial_over_2y',
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
        if (status === 'ACTIVE') {
          // cache only if nothing higher precedence is set
          const curr = await User.findById(user._id).select('membershipLevel').lean();
          if (!curr?.membershipLevel) {
            await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } });
          }
        }
        fellBackInternal++;
        upsertedSubs++;
        continue;
      }

      // Skip auto-creating a paid Stripe subscription if the legacy end is not in the future
      if (!legacyEnd || legacyEnd <= now) {
        logger?.info?.(`Skipping Stripe sub for ${email} (${level.key}) because legacy end is missing/past`);
        continue;
      }

      // Guard: if a Stripe sub for this price already exists (active/trialing), reuse it
      const existing = await findExistingStripeSub(customerId, level.stripePriceId);
      let sub = existing;

      if (!sub) {
        sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: level.stripePriceId, quantity: 1 }],
          trial_end: trialEndUnix || undefined,
          collection_method: 'charge_automatically', // explicit
          payment_settings: { save_default_payment_method: 'on_subscription' },
          metadata: { converted_from: 'LEGACY', levelKey: level.key },
          // trial_settings.end_behavior: { missing_payment_method: 'cancel' } // (optional)
        });

        createdStripeSubs++;
      }

      // Upsert local "stripe" subscription row
      const statusLocal = mapStripeStatus(sub.status);
      const nextBill = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

      await Subscription.updateOne(
        { userId: user._id, levelId: level._id, gateway: 'stripe', kind: 'RECURRING' },
        {
          $set: {
            planName,
            autoRenews: true,
            stripeSubscriptionId: sub.id,
            stripeStatus: sub.status,                 // <-- NEW
            status: statusLocal,
            startDate: new Date(sub.current_period_start * 1000),
            endDate: null,
            nextBillDate: nextBill,
            cancelReason: usedGrace ? `trial_end_extended_30d_from_${legacyEnd?.toISOString()}` : undefined,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      upsertedSubs++;

      // Cache membership: treat trialing as active access
      if (statusLocal === 'ACTIVE') {
        const curr = await User.findById(user._id).select('membershipLevel').lean();
        if (!curr?.membershipLevel || curr.membershipLevel !== 'LIFETIME') {
          await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } });
        }
      }
      continue;
    }

    // Unknown type: skip
    logger?.warn?.(`Unknown type for ${email} plan "${planName}" — skipped`);
  }

  console.log({ createdUsers, updatedUsers, upsertedSubs, createdStripeSubs, fellBackInternal });
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
