// scripts/sendMigrationPasswordInvites.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { formatInTimeZone } from 'date-fns-tz';
import User from '../backend/src/models/user.model';
import { issueResetTokenForUser } from '../backend/src/utils/accounts/tokens';
import { senderEmailService } from '../backend/src/utils/email/senderService';
import { logger } from '../backend/src/utils/general/logger';
import { MONGODB_URI } from '../backend/src/config/env';
import { getFrontendUrl } from '../backend/src/config/urls';

const HOURS = 144; // 6 days

async function main() {
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({
    status: 'ACTIVE',
    migratedFromLegacy: true,
    migrationPasswordInviteSentAt: { $exists: false },
  }).lean();

  logger.info(`Found ${users.length} users for migration invites.`);

  for (const u of users) {
    if (u.status !== 'ACTIVE') {
      continue; // skip silently
    }
    try {
      const { rawToken, expires } = await issueResetTokenForUser(u._id.toString(), HOURS);
      
      // Construct membership URL using proper config
      const base = (process.env.CLIENT_URL || getFrontendUrl()).replace(/\/$/, '');
      const membershipUrl = `${base}/become-a-member`;


      // Absolute expiry string for the email (Eastern Time)
      const expiryDisplayNY = formatInTimeZone(expires, 'America/New_York', 'MMM d, yyyy h:mm a zzz');

      // Membership flags
      const LIFETIME_NAMES = new Set(['Lifetime', 'Student', 'Associate Life']);
      const isLifetime  = !!u.membershipLevel && LIFETIME_NAMES.has(u.membershipLevel);
      const isRecurring = !!u.membershipLevel && !LIFETIME_NAMES.has(u.membershipLevel);
      const isExpired   = !u.membershipLevel;

      // Compute a billing_deadline_date for recurring
      // ex. 30 days from now, or u.nextBillDate if you have it synced
      const billingDeadlineNY = formatInTimeZone(new Date(Date.now() + 21 * 24 * 3600 * 1000), 'America/New_York', 'MMM d, yyyy');

      // Ensure Sender.net is configured
      if (!senderEmailService.isServiceConfigured()) {
        throw new Error('Sender.net not configured');
      }

      await senderEmailService.sendMigrationPasswordInviteEmail(
        u.email,
        `${u.name?.first || ''} ${u.name?.last || ''}`.trim(),
        u._id.toString(),
        rawToken,
        {
          username: u.username,
          resetExpiresHours: HOURS,
          resetExpiresAtDisplay: expiryDisplayNY,
          is_lifetime: isLifetime,
          is_recurring: !!isRecurring,
          is_expired: !!isExpired,
          // swap out the old portal link for the public page:
          pricing_page_url: membershipUrl,
          billing_deadline_date: billingDeadlineNY
        }
      );

      // Mark we sent it (optional, useful to make script idempotent)
      await User.updateOne({ _id: u._id }, {
        $set: { migrationPasswordInviteSentAt: new Date() }
      });

      logger.info('Sent migration password invite', { userId: u._id, email: u.email });
    } catch (e: any) {
      logger.warn('Failed sending invite', { userId: u._id, email: u.email, error: e?.message });
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
