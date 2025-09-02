// scripts/importLegacyMembers.ts.

import 'dotenv/config';
import path from 'path';
import fs from 'fs';

// Load .env
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../backend/src/models/user.model';
import Subscription from '../backend/src/models/subscription.model';
import MembershipLevel from '../backend/src/models/membershipLevel.model';
import { normalizeEmail } from '../backend/src/utils/email/emailUtils';
import { stripe } from '../backend/src/lib/stripe/client';
import { logger } from '../backend/src/utils/general/logger';
import { recomputeUserAccountStatus } from '../backend/src/services/subscriptions/accountStatus';

type Row = {
  email: string;
  firstName?: string; lastName?: string; username?: string;
  levelKey: string;
  type: 'lifetime' | 'recurring' | 'unknown';
  startDate?: string | null;
  endDate?: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';
};

// Dry-run reporting types
type DryRunReport = {
  summary: {
    totalRecords: number;
    validRecords: number;
    skippedRecords: number;
    errors: number;
    usersToCreate: number;
    usersToUpdate: number;
    subscriptionsToCreate: number;
    stripeSubscriptionsToCreate: number;
    fallbackInternalSubs: number;
    lifetimeSubs: number;
    expiredSubs: number;
  };
  details: {
    validRecords: Array<{
      email: string;
      levelKey: string;
      type: string;
      action: 'CREATE_USER' | 'UPDATE_USER' | 'SKIP_USER';
      subscriptionAction: 'CREATE_LIFETIME' | 'CREATE_STRIPE_TRIAL' | 'CREATE_INTERNAL' | 'CREATE_EXPIRED' | 'SKIP_SUBSCRIPTION';
      trialEndDate?: string;
      gracePeriodUsed?: boolean;
      errors: string[];
      warnings: string[];
    }>;
    skippedRecords: Array<{ email: string; reason: string; details?: any }>;
    errors: Array<{ email: string; error: string; details?: any }>;
  };
  validation: {
    membershipLevelsFound: string[];
    membershipLevelsMissing: string[];
    dataIntegrityIssues: string[];
    multipleActiveUsers: Array<{ email: string; count: number; userIds: string[] }>;
  };
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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findUserByEmailAnyCase(email: string) {
  let u = await User.findOne({ email });
  if (u) return u;
  return User.findOne({ email: new RegExp(`^${escapeRegExp(email)}$`, 'i') });
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
  const normalizedEmail = normalizeEmail(user.email);
  const cust = await stripe.customers.create({
    email: normalizedEmail,
    name: [user.name?.first, user.name?.last].filter(Boolean).join(' ') || undefined,
    metadata: { legacy: 'true', legacy_source: 'wordpress' },
  });
  await User.updateOne({ _id: user._id }, { $set: { stripeCustomerId: cust.id } });
  return cust.id;
}

function computeTrialEnd(now: Date, legacyEnd?: Date) {
  if (!legacyEnd || isNaN(legacyEnd.getTime())) return { trialEndUnix: null, usedGrace: false, tooLong: false };

  const threshold = new Date(now.getTime() + GRACE_DAYS*24*60*60*1000);
  // extend by 30d if within the next 30d window
  const desired = (legacyEnd > now && legacyEnd <= threshold)
    ? new Date(legacyEnd.getTime() + GRACE_DAYS*24*60*60*1000)
    : legacyEnd;

  const maxTrialEnd = new Date(now.getTime() + MAX_TRIAL_SECONDS*1000);
  if (desired > maxTrialEnd) return { trialEndUnix: null, usedGrace: false, tooLong: true };
  return { trialEndUnix: Math.floor(desired.getTime() / 1000), usedGrace: desired.getTime() !== legacyEnd.getTime(), tooLong: false };
}

async function findExistingStripeSub(customerId: string, priceId: string) {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  return list.data.find(sub =>
    sub.items.data.some(it => it.price?.id === priceId) &&
    sub.status !== 'canceled'
  );
}

function mapStripeStatus(s: string): 'ACTIVE' | 'CANCELLED' | 'EXPIRED' {
  if (['active', 'trialing', 'past_due', 'incomplete'].includes(s)) return 'ACTIVE';
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(s)) return 'CANCELLED';
  return 'ACTIVE';
}

// ---------- dry-run helpers ----------
async function validateLegacyData(rows: Row[]): Promise<DryRunReport['validation']> {
  const membershipLevelsFound = new Set<string>();
  const membershipLevelsMissing = new Set<string>();
  const dataIntegrityIssues: string[] = [];
  const multipleActiveUsers: Array<{ email: string; count: number; userIds: string[] }> = [];

  const emailToUsers = new Map<string, Array<{ _id: string; email: string; status: string }>>();

  for (const row of rows) {
    const normalizedEmail = normalizeEmail(row.email);
    if (!normalizedEmail) continue;
    
    // Check existing users with this email
    const existingUsers = await User.find({ 
      email: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i') 
    }).select('_id email status').lean();
    if (existingUsers.length > 0) {
      emailToUsers.set(normalizedEmail, existingUsers);
    }
  }

  // Find emails with multiple ACTIVE users
  for (const [email, users] of emailToUsers) {
    const activeUsers = users.filter(u => u.status === 'ACTIVE');
    if (activeUsers.length > 1) {
      multipleActiveUsers.push({
        email,
        count: activeUsers.length,
        userIds: activeUsers.map(u => u._id.toString())
      });
    }
  }

  for (const row of rows) {
    if (row.levelKey) {
      const level = await MembershipLevel.findOne({ key: row.levelKey, status: 'ACTIVE' });
      if (level) {
        // Ensure price exists for recurring levels
        if (row.type === 'recurring' && !level.stripePriceId) {
          dataIntegrityIssues.push(`Recurring level ${row.levelKey} missing stripePriceId`);
        }
        membershipLevelsFound.add(row.levelKey);
      } else {
        membershipLevelsMissing.add(row.levelKey);
      }
    }
    if (row.type === 'recurring' && !row.endDate) dataIntegrityIssues.push(`Recurring ${row.email} has no endDate`);
    if (row.type === 'lifetime' && row.endDate) dataIntegrityIssues.push(`Lifetime ${row.email} has endDate`);
    if (row.startDate && parseDate(row.startDate) && parseDate(row.endDate) && parseDate(row.startDate)! > parseDate(row.endDate)!) {
      dataIntegrityIssues.push(`startDate > endDate for ${row.email}`);
    }
  }

  return {
    membershipLevelsFound: Array.from(membershipLevelsFound),
    membershipLevelsMissing: Array.from(membershipLevelsMissing),
    dataIntegrityIssues,
    multipleActiveUsers
  };
}

async function dryRunMigration(rows: Row[]): Promise<DryRunReport> {
  const report: DryRunReport = {
    summary: {
      totalRecords: rows.length,
      validRecords: 0,
      skippedRecords: 0,
      errors: 0,
      usersToCreate: 0,
      usersToUpdate: 0,
      subscriptionsToCreate: 0,
      stripeSubscriptionsToCreate: 0,
      fallbackInternalSubs: 0,
      lifetimeSubs: 0,
      expiredSubs: 0,
    },
    details: {
      validRecords: [],
      skippedRecords: [],
      errors: []
    },
    validation: await validateLegacyData(rows)
  };

  const now = new Date();

  for (const r of rows) {
    const recordDetail: DryRunReport['details']['validRecords'][0] = {
      email: r.email,
      levelKey: r.levelKey,
      type: r.type,
      action: 'SKIP_USER',
      subscriptionAction: 'SKIP_SUBSCRIPTION',
      trialEndDate: undefined,
      gracePeriodUsed: undefined,
      errors: [],
      warnings: []
    };

    try {
      // Validate email
      const norm0 = normalizeEmail(r.email);
      if (!norm0) {
        recordDetail.errors.push('Invalid email format');
        report.details.skippedRecords.push({
          email: r.email,
          reason: 'Invalid email format'
        });
        report.summary.skippedRecords++;
        continue;
      }

      // Validate levelKey
      if (!r.levelKey?.trim()) {
        recordDetail.errors.push('Missing levelKey');
        report.details.skippedRecords.push({
          email: r.email,
          reason: 'Missing levelKey'
        });
        report.summary.skippedRecords++;
        continue;
      }

      const level = await MembershipLevel.findOne({ key: r.levelKey, status: 'ACTIVE' });
      if (!level) {
        recordDetail.errors.push(`MembershipLevel ${r.levelKey} not found`);
        report.details.skippedRecords.push({
          email: r.email,
          reason: `MembershipLevel ${r.levelKey} not found`
        });
        report.summary.skippedRecords++;
        continue;
      }

      // Check existing user
      const existingUser = await findUserByEmailAnyCase(r.email);
      if (existingUser) {
        recordDetail.action = 'UPDATE_USER';
        report.summary.usersToUpdate++;
        
        // Check for conflicts
        if (existingUser.status === 'ACTIVE') {
          recordDetail.warnings.push('User already has ACTIVE status');
        }
        // Note: User status will be recomputed based on actual entitlements
      } else {
        recordDetail.action = 'CREATE_USER';
        report.summary.usersToCreate++;
      }

      // Determine subscription action
      if (r.type === 'lifetime') {
        recordDetail.subscriptionAction = 'CREATE_LIFETIME';
        report.summary.lifetimeSubs++;
        report.summary.subscriptionsToCreate++;
      } else if (r.type === 'recurring') {
        const legacyEnd = parseDate(r.endDate);
        const { trialEndUnix, usedGrace, tooLong } = computeTrialEnd(now, legacyEnd);

        if (tooLong) {
          recordDetail.subscriptionAction = 'CREATE_INTERNAL';
          report.summary.fallbackInternalSubs++;
          report.summary.subscriptionsToCreate++;
        } else if (!legacyEnd || legacyEnd <= now) {
          recordDetail.subscriptionAction = 'CREATE_EXPIRED';
          report.summary.expiredSubs++;
          report.summary.subscriptionsToCreate++;
        } else {
          recordDetail.subscriptionAction = 'CREATE_STRIPE_TRIAL';
          report.summary.stripeSubscriptionsToCreate++;
          report.summary.subscriptionsToCreate++;
          
          if (trialEndUnix) {
            recordDetail.trialEndDate = new Date(trialEndUnix * 1000).toISOString();
          }
          if (usedGrace) {
            recordDetail.gracePeriodUsed = true;
            recordDetail.warnings.push('30-day grace period will be applied');
          }
        }
      } else {
        recordDetail.errors.push(`Unknown subscription type: ${r.type}`);
        report.details.skippedRecords.push({
          email: r.email,
          reason: `Unknown subscription type: ${r.type}`
        });
        report.summary.skippedRecords++;
        continue;
      }

      report.details.validRecords.push(recordDetail);
      report.summary.validRecords++;

    } catch (error) {
      recordDetail.errors.push(`Processing error: ${error instanceof Error ? error.message : String(error)}`);
      report.details.errors.push({
        email: r.email,
        error: error instanceof Error ? error.message : String(error),
        details: error
      });
      report.summary.errors++;
    }
  }

  return report;
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  const showDetails = args.includes('--details') || args.includes('-v');
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

  console.log(`🚀 Starting migration ${isDryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`📊 Details: ${showDetails ? 'ON' : 'OFF'}`);
  if (outputFile) console.log(`📄 Output file: ${outputFile}`);
  console.log(`🏷️ Stripe key mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);

  await mongoose.connect(process.env.MONGODB_URI!);

  const rows: Row[] = JSON.parse(
    fs.readFileSync(path.resolve('./scripts/data/legacyMembers.json'), 'utf8')
  );

  if (isDryRun) {
    console.log('\n🔍 Running dry-run validation...');
    const report = await dryRunMigration(rows);
    
    // Print summary
    console.log('\n📋 DRY RUN SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total records: ${report.summary.totalRecords}`);
    console.log(`Valid records: ${report.summary.validRecords}`);
    console.log(`Skipped records: ${report.summary.skippedRecords}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log('');
    console.log('📈 MIGRATION PLAN:');
    console.log(`Users to create: ${report.summary.usersToCreate}`);
    console.log(`Users to update: ${report.summary.usersToUpdate}`);
    console.log(`Subscriptions to create: ${report.summary.subscriptionsToCreate}`);
    console.log(`  - Stripe trials: ${report.summary.stripeSubscriptionsToCreate}`);
    console.log(`  - Internal fallbacks: ${report.summary.fallbackInternalSubs}`);
    console.log(`  - Lifetime: ${report.summary.lifetimeSubs}`);
    console.log(`  - Expired: ${report.summary.expiredSubs}`);

    // Print validation results
    console.log('\n✅ VALIDATION RESULTS:');
    console.log('='.repeat(50));
    console.log(`Membership levels found: ${report.validation.membershipLevelsFound.join(', ') || 'None'}`);
    console.log(`Membership levels missing: ${report.validation.membershipLevelsMissing.join(', ') || 'None'}`);
    console.log(`Data integrity issues: ${report.validation.dataIntegrityIssues.length}`);
    console.log(`Multiple ACTIVE users with same email: ${report.validation.multipleActiveUsers.length}`);
    
    if (report.validation.dataIntegrityIssues.length > 0) {
      console.log('\n⚠️  DATA INTEGRITY ISSUES:');
      report.validation.dataIntegrityIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (report.validation.membershipLevelsMissing.length > 0) {
      console.log('\n❌ MISSING MEMBERSHIP LEVELS:');
      report.validation.membershipLevelsMissing.forEach(level => console.log(`  - ${level}`));
    }

    if (report.validation.multipleActiveUsers.length > 0) {
      console.log('\n🚨 MULTIPLE ACTIVE USERS WITH SAME EMAIL:');
      report.validation.multipleActiveUsers.forEach(item => {
        console.log(`  - ${item.email}: ${item.count} ACTIVE users (IDs: ${item.userIds.join(', ')})`);
      });
    }

    // Print detailed results if requested
    if (showDetails) {
      console.log('\n📝 DETAILED RESULTS:');
      console.log('='.repeat(50));
      
      console.log('\n✅ VALID RECORDS:');
      report.details.validRecords.forEach(record => {
        console.log(`\n${record.email}:`);
        console.log(`  Level: ${record.levelKey} (${record.type})`);
        console.log(`  User action: ${record.action}`);
        console.log(`  Subscription action: ${record.subscriptionAction}`);
        if (record.trialEndDate) console.log(`  Trial ends: ${record.trialEndDate}`);
        if (record.gracePeriodUsed) console.log(`  Grace period: Applied`);
        if (record.warnings.length > 0) {
          console.log(`  Warnings: ${record.warnings.join(', ')}`);
        }
      });

      if (report.details.skippedRecords.length > 0) {
        console.log('\n⏭️  SKIPPED RECORDS:');
        report.details.skippedRecords.forEach(record => {
          console.log(`  ${record.email}: ${record.reason}`);
        });
      }

      if (report.details.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        report.details.errors.forEach(error => {
          console.log(`  ${error.email}: ${error.error}`);
        });
      }
    }

    // Save report to file if requested
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`\n💾 Report saved to: ${outputFile}`);
    }

    console.log('\n🔍 DRY RUN COMPLETED - No changes were made to the database or Stripe');
    console.log('To run the actual migration, remove the --dry-run flag');
    
    await mongoose.disconnect();
    return;
  }

  // LIVE
  const now = new Date();
  console.log('\n🚀 STARTING LIVE MIGRATION');
  console.log('='.repeat(50));
  console.log(`📊 Processing ${rows.length} records...`);
  console.log(`⏰ Started at: ${now.toISOString()}`);

  let createdUsers = 0, updatedUsers = 0, upsertedSubs = 0, createdStripeSubs = 0, fellBackInternal = 0;
  let skippedRecords = 0, errors = 0, lifetimeSubs = 0, expiredSubs = 0;
  let processedCount = 0;
  const startTime = Date.now();
  const progressInterval = Math.max(1, Math.floor(rows.length / 20));

  console.log('\n⚠️  WARNING: This is LIVE migration mode!');
  console.log('Database and Stripe will be modified.\n');

  for (const r of rows) {
    processedCount++;
    if (processedCount % progressInterval === 0 || processedCount === rows.length) {
      const progress = ((processedCount / rows.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`📈 Progress: ${processedCount}/${rows.length} (${progress}%) - ${elapsed}s elapsed`);
    }

    if (!r?.email) { skippedRecords++; continue; }
    const norm0 = normalizeEmail(r.email);
    if (!norm0) { console.log(`❌ Skipping invalid email: ${r.email}`); skippedRecords++; continue; }
    const email = norm0;

    const levelKey = (r.levelKey || '').trim();
    if (!levelKey) { console.log(`❌ Skipping ${email}: no level key provided`); skippedRecords++; continue; }

    const level = await MembershipLevel.findOne({ key: levelKey, status: 'ACTIVE' });
    if (!level) { console.log(`❌ Skipping ${email}: missing ACTIVE MembershipLevel ${levelKey}`); skippedRecords++; continue; }

    // Guard recurring levels must have stripePriceId
    if (r.type === 'recurring' && !level.stripePriceId) {
      console.log(`❌ Skipping ${email}: level ${level.key} has no stripePriceId`);
      skippedRecords++;
      continue;
    }

    const planName = level.key;

    // USER UPSERT
    const first = (r.firstName || '').trim();
    const last  = (r.lastName  || '').trim();
    const tmpPassword = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(tmpPassword, 12);
    const desired = (r.username && r.username.trim()) || email.split('@')[0];
    const username = await ensureUsername(desired);
    let user = await findUserByEmailAnyCase(email);

    if (!user) {
      try {
        user = await User.create({
          email,
          username,
          name: { first: first || 'Member', last: last || 'Legacy' },
          passwordHash,
          signupIntent: { levelKey: level.key, source: 'legacy_migration' },
          migratedFromLegacy: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        createdUsers++;
        console.log(`✅ Created new user: ${email} (${level.key})`);
      } catch (error: any) {
        if (error?.code === 11000 && error?.keyPattern?.email) {
          console.log(`⚠️  Duplicate email ${email}; fetching existing user...`);
          user = await findUserByEmailAnyCase(email);
          if (!user) { console.log(`❌ Could not fetch user after duplicate: ${email}`); errors++; continue; }
          await recomputeUserAccountStatus(user._id);
          updatedUsers++;
          console.log(`✅ Updated existing user after duplicate: ${email}`);
        } else {
          console.log(`❌ Failed to create user ${email}: ${error.message}`); errors++; continue;
        }
      }
    } else {
      const activeUser = await User.findOne({ email, status: 'ACTIVE' });
      if (activeUser && activeUser._id.toString() !== user._id.toString()) {
        console.log(`⚠️  Skipping ${email}: already has ACTIVE user (${activeUser._id})`); skippedRecords++; continue;
      }
      await recomputeUserAccountStatus(user._id);
      updatedUsers++;
      console.log(`✅ Updated existing user: ${email} (${level.key})`);
    }

    // Skip if they already have an ACTIVE sub (except allow lifetime to add)
    const existingActive = await Subscription.findOne({ userId: user._id, status: 'ACTIVE' }).lean();
    if (existingActive && r.type !== 'lifetime') {
      console.log(`⚠️  Skip: ${email} already has ACTIVE sub (${existingActive.levelId})`);
      await recomputeUserAccountStatus(user._id);
      skippedRecords++;
      continue;
    }

    // LIFETIME -> internal ONE_TIME
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
      await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } });
      await recomputeUserAccountStatus(user._id);
      upsertedSubs++; lifetimeSubs++;
      console.log(`✅ Created LIFETIME subscription: ${email} (${level.key})`);
      continue;
    }

    // RECURRING
    if (r.type === 'recurring') {
      const legacyEnd = parseDate(r.endDate);
      const { trialEndUnix, usedGrace, tooLong } = computeTrialEnd(now, legacyEnd);

      // Too long to represent as Stripe trial -> internal fallback
      if (tooLong) {
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
          await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } });
        } else {
          await User.updateOne({ _id: user._id }, { $unset: { membershipLevel: 1 } });
        }
        await recomputeUserAccountStatus(user._id);
        fellBackInternal++; upsertedSubs++;
        console.log(`✅ Created INTERNAL subscription (trial too long): ${email} (${level.key}) - ${status}`);
        continue;
      }

      // Legacy end not in the future -> local EXPIRED history
      if (!legacyEnd || legacyEnd <= now) {
        await Subscription.updateOne(
          { userId: user._id, levelId: level._id, gateway: 'internal', kind: 'RECURRING' },
          {
            $set: {
              planName,
              autoRenews: false,
              stripeSubscriptionId: null,
              status: 'EXPIRED',
              startDate: parseDate(r.startDate) || user.createdAt,
              endDate: legacyEnd || now,
              nextBillDate: null,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
        upsertedSubs++; expiredSubs++;
        console.log(`✅ Created EXPIRED subscription: ${email} (${level.key}) - legacy end was ${legacyEnd?.toISOString() || 'missing'}`);
        await User.updateOne({ _id: user._id }, { $unset: { membershipLevel: 1 } });
        await recomputeUserAccountStatus(user._id);
        continue;
      }

      // Need to touch Stripe from here on
      const customerId = await ensureStripeCustomerId(user);

      // Reuse existing matching Stripe subscription if present
      let sub = await findExistingStripeSub(customerId, level.stripePriceId!);

      if (!sub) {
        // NEW: Idempotency key to prevent duplicates on retries
        const idemKey = `legacy-sub-create:${customerId}:${level.stripePriceId}:${trialEndUnix ?? 'no-trial'}`;
        sub = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: level.stripePriceId!, quantity: 1 }],
            trial_end: trialEndUnix || undefined, // requires future UNIX timestamp
            collection_method: 'charge_automatically',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            metadata: { converted_from: 'LEGACY', levelKey: level.key, userId: String(user._id) },
            proration_behavior: 'none',
            // (Optional) payment_behavior: 'default_incomplete' // If you want invoice+PI flow, but not needed on trial
          },
          { idempotencyKey: idemKey } // NEW
        );
        createdStripeSubs++;
        console.log(`✅ Created Stripe subscription: ${email} (${level.key}) - trial ends ${trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : 'n/a'}`);
      } else {
        console.log(`ℹ️  Reused existing Stripe subscription: ${email} → ${sub.id} (${sub.status})`);
      }

      const statusLocal = mapStripeStatus(sub.status);
      const nextBill = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

      await Subscription.updateOne(
        { userId: user._id, levelId: level._id, gateway: 'stripe', kind: 'RECURRING' },
        {
          $set: {
            planName,
            autoRenews: true,
            stripeSubscriptionId: sub.id,
            stripeStatus: sub.status,
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

      if (statusLocal === 'ACTIVE') {
        await User.updateOne({ _id: user._id }, { $set: { membershipLevel: level.key } });
      }
      await recomputeUserAccountStatus(user._id);
      continue;
    }

    // Unknown type: skip creating entitlements
    console.log(`❌ Unknown type for ${email} at levelKey "${levelKey}" — skipped`);
    skippedRecords++;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n🎉 MIGRATION COMPLETED!');
  console.log('='.repeat(50));
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log(`📊 Records processed: ${processedCount}/${rows.length}`);
  console.log('');
  console.log('📈 FINAL SUMMARY:');
  console.log(`✅ Users created: ${createdUsers}`);
  console.log(`🔄 Users updated: ${updatedUsers}`);
  console.log(`📦 Subscriptions created/updated: ${upsertedSubs}`);
  console.log(`  - Lifetime: ${lifetimeSubs}`);
  console.log(`  - Stripe trials created: ${createdStripeSubs}`);
  console.log(`  - Internal fallbacks: ${fellBackInternal}`);
  console.log(`  - Expired: ${expiredSubs}`);
  console.log(`⏭️  Records skipped: ${skippedRecords}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('\n🔗 Database connection closed');

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
