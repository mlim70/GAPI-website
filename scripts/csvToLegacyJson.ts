#!/usr/bin/env tsx
/**
 * Convert legacy CSV -> normalized JSON for importer
 *
 * Input CSV expected columns (case-insensitive):
 * id, username, firstname, lastname, email, membership,
 * discount_code_id, discount_code, subscription_transaction_id,
 * billing_amount, cycle_number, cycle_period, next_payment_date,
 * joined, expires
 *
 * Usage:
 *   npx tsx scripts/csvToLegacyJson.ts ./input.csv ./output.json [--mutate-emails]
 *
 * Flags:
 *   --mutate-emails   Append 'x' to the email local-part to avoid using real emails (safe testing)
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { parse as parseDateFns, format as formatDateFns, isValid } from 'date-fns';

type RowIn = Record<string, string | undefined>;

type RowOut = {
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  levelKey: string;                   // Title Case label expected by your importer
  type: 'lifetime' | 'recurring' | 'unknown';
  startDate: string | null;           // YYYY-MM-DD
  endDate: string | null;             // YYYY-MM-DD
  status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';
};

// -------- CLI --------
const [, , inputPathArg, outputPathArg, ...flags] = process.argv;
if (!inputPathArg || !outputPathArg) {
  console.error('Usage: npx tsx scripts/csvToLegacyJson.ts <input.csv> <output.json> [--mutate-emails]');
  process.exit(1);
}
const mutateEmails = flags.includes('--mutate-emails');

// -------- Helpers --------
const lowerKeys = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) out[k.toLowerCase()] = obj[k];
  return out;
};

const trimOrNull = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

// Parse many formats -> 'YYYY-MM-DD' or null
const parseDate = (val: any): string | null => {
  const s = trimOrNull(val);
  if (!s) return null;

  const patterns = [
    'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy', 'yyyy/MM/dd', 'MM/dd/yy', 'M/d/yyyy', 'M/d/yy'
  ];

  for (const p of patterns) {
    const dt = parseDateFns(s, p, new Date());
    if (isValid(dt)) return formatDateFns(dt, 'yyyy-MM-dd');
  }

  const native = new Date(s);
  if (isValid(native)) return formatDateFns(native, 'yyyy-MM-dd');

  return null;
};

const mutateEmail = (email: string | null): string | null => {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at === -1) return email; // malformed, leave as-is
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${user}x@${domain}`;
};

// Normalize membership to Title Case levelKey
const titlecaseLevel = (membership: string | null): string => {
  if (!membership) return 'Unknown';
  const raw = membership.trim().toLowerCase();

  const map: Record<string, string> = {
    'lifetime': 'Lifetime',
    'associate life': 'Associate Life',
    'associate': 'Associate',
    'student': 'Student',
    'annual': 'Annual',
    'one time': 'One Time',
    'one-time': 'One Time',
    'free': 'Free',
    'trial': 'Trial',
  };

  if (raw in map) return map[raw];
  return raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Map levelKey -> importer type
const classifyType = (levelKey: string): RowOut['type'] => {
  const l = levelKey.toLowerCase();
  if (l.startsWith('lifetime') || l === 'associate life' || l === 'student') return 'lifetime';
  if (l.startsWith('one time') || l === 'free' || l === 'trial') return 'unknown';
  return 'recurring';
};

// Choose endDate; lifetime -> null; otherwise prefer next_payment_date then expires
const chooseEndDate = (
  rowType: RowOut['type'],
  nextPaymentISO: string | null,
  expiresISO: string | null
): string | null => {
  if (rowType === 'lifetime') return null;
  return nextPaymentISO || expiresISO || null;
};

// Compute status per agreed rules
const computeStatus = (
  rowType: RowOut['type'],
  endDateISO: string | null
): RowOut['status'] => {
  if (rowType === 'lifetime') return 'ACTIVE';

  const todayYMD = formatDateFns(new Date(), 'yyyy-MM-dd');

  const asActiveOrExpired = (iso: string | null): RowOut['status'] => {
    if (!iso) return 'UNKNOWN';
    const d = parseDateFns(iso, 'yyyy-MM-dd', new Date());
    if (!isValid(d)) return 'UNKNOWN';
    const today = parseDateFns(todayYMD, 'yyyy-MM-dd', new Date());
    return d >= today ? 'ACTIVE' : 'EXPIRED';
  };

  if (rowType === 'recurring') {
    // ACTIVE if endDate >= today; EXPIRED if < today; UNKNOWN if missing/invalid
    return asActiveOrExpired(endDateISO);
  }

  // 'unknown' tiers (One Time / Free / Trial): default to UNKNOWN unless endDate is present
  return asActiveOrExpired(endDateISO);
};

// -------- Transform one row --------
const transform = (r: RowIn): RowOut => {
  const row = lowerKeys(r);

  const emailRaw = trimOrNull(row['email']);
  const email = mutateEmails ? mutateEmail(emailRaw) : emailRaw;

  const username = trimOrNull(row['username']);
  const firstName = trimOrNull(row['firstname']);
  const lastName = trimOrNull(row['lastname']);

  const membership = trimOrNull(row['membership']);
  const levelKey = titlecaseLevel(membership);
  const type = classifyType(levelKey);

  const joined = parseDate(row['joined']);
  const expires = parseDate(row['expires']);
  const nextPayment = parseDate(row['next_payment_date']);

  const endDate = chooseEndDate(type, nextPayment, expires);
  const status = computeStatus(type, endDate);

  const out: RowOut = {
    email,
    firstName,
    lastName,
    username,
    levelKey,
    type,
    startDate: joined,
    endDate,
    status,
  };

  return out;
};

// -------- Main --------
async function main() {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const outputPath = path.resolve(process.cwd(), outputPathArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input CSV not found: ${inputPath}`);
    process.exit(1);
  }

  const parser = fs.createReadStream(inputPath).pipe(parse({
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }));

  const outRows: RowOut[] = [];
  for await (const rec of parser) {
    outRows.push(transform(rec as RowIn));
  }

  fs.writeFileSync(outputPath, JSON.stringify(outRows, null, 2), 'utf-8');
  console.log(`✅ Wrote ${outRows.length} rows to ${outputPath}`);
  console.log(`   mutate-emails: ${mutateEmails ? 'ON' : 'OFF'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
