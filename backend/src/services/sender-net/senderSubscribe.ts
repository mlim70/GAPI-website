// Sender.net newsletter service for GAPI (API-resubscribe attempt)
import axios from 'axios';
import { SENDER_API_KEY, SENDER_LIST_ID } from '../../config/env';
import { normalizeEmail } from '../../utils/email/emailUtils';
import { logger } from '../../utils/general/logger';

function extractStatuses(d: any): {
  marketing: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'SPAM_REPORTED' | 'UNKNOWN';
  transactional: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'SPAM_REPORTED' | 'UNKNOWN';
} {
  const sub = (d?.subscriber_status || '').toUpperCase();
  const tran = (d?.transactional_email_status || '').toUpperCase();

  // Legacy/alternative shape
  const legacyEmail = (d?.status?.email || '').toUpperCase();
  const legacyTemail = (d?.status?.temail || '').toUpperCase();

  const pick = (a: string, b: string) =>
    (a === 'ACTIVE' || a === 'UNSUBSCRIBED' || a === 'BOUNCED' || a === 'SPAM_REPORTED')
      ? a
      : (b === 'ACTIVE' || b === 'UNSUBSCRIBED' || b === 'BOUNCED' || b === 'SPAM_REPORTED')
        ? b
        : 'UNKNOWN';

  return {
    marketing: pick(sub, legacyEmail),
    transactional: pick(tran, legacyTemail),
  };
}

function sx() {
  if (!SENDER_API_KEY) throw new Error('Sender.net API key not configured');
  return {
    headers: { Authorization: `Bearer ${SENDER_API_KEY}`, 'Content-Type': 'application/json' },
  } as const;
}

const groupId = SENDER_LIST_ID; // Subscribers 'group id'

// Add member to group
async function addToGroup(email: string) {
  if (!groupId) return;
  try {
    const res = await axios.post(
      `https://api.sender.net/v2/subscribers/groups/${groupId}`,
      { subscribers: [normalizeEmail(email)], /* trigger_automation: false */ },
      sx()
    );
    logger.info('Sender: addToGroup', { data: res.data });
  } catch (e: any) {
    logger.warn('Sender: addToGroup failed', { status: e.response?.status, data: e.response?.data });
  }
}

/** Get subscriber (GLOBAL) */
export async function senderGetSubscriber(email: string) {
  const enc = encodeURIComponent(normalizeEmail(email));
  const res = await axios.get(`https://api.sender.net/v2/subscribers/${enc}`, sx());
  return res.data; // shape: { success, message, data: {...} }
}

/** Subscribe or re-subscribe */
export async function senderSubscribe(email: string, vars: Record<string, any> = {}) {
  const normalized = normalizeEmail(email);
  logger.info('📧 Sender: subscribe', { email: normalized, vars });

  // 1) Upsert (global)
  const createRes = await axios.post(
    'https://api.sender.net/v2/subscribers',
    {
      email: normalized,
      fields: vars.fields,
    },
    sx()
  );
  logger.info('Sender: create/upsert', { data: createRes.data });

  // 2) Attempt to RESUBSCRIBE via API using documented keys
  const enc = encodeURIComponent(normalizeEmail(email));
  const patchRes = await axios.patch(
    `https://api.sender.net/v2/subscribers/${enc}`,
    {
      // Flip both channels to ACTIVE (per docs)
      subscriber_status: 'ACTIVE',
      transactional_email_status: 'ACTIVE',
      groups: groupId ? [groupId] : undefined,
    },
    sx()
  );
  logger.info('Sender: resubscribe PATCH', { data: patchRes.data });

  // 3) Ensure group membership
  await addToGroup(normalized);

  // 4) Verify
  const verify = await senderGetSubscriber(normalized);
  const d = verify?.data ?? {};
  const { marketing, transactional } = extractStatuses(d);
  const tags = (d.subscriber_tags || []).map((t: any) => t.title);

  logger.info('Sender: verify', { marketing, transactional, tags, rawKeys: Object.keys(d || {}) });

  // Accept "ACTIVE" for marketing to count as subscribed
  if (marketing !== 'ACTIVE') {
    throw new Error(`Marketing channel not active (marketing=${marketing}). If the user previously unsubscribed, your workspace may require UI re-consent.`);
  }

  // Transactional can be separate; warn if not ACTIVE but don't hard-fail unless you require it
  if (transactional !== 'ACTIVE') {
    logger.warn('Transactional channel not ACTIVE (transactional=%s). You can still use transactional-sending endpoints if your plan allows.', transactional);
  }

  return verify;
}

/** Unsubscribe (GLOBAL) using documented key */
export async function senderUnsubscribe(email: string) {
  const enc = encodeURIComponent(normalizeEmail(email));
  const res = await axios.patch(
    `https://api.sender.net/v2/subscribers/${enc}`,
    {
      subscriber_status: 'UNSUBSCRIBED',
      transactional_email_status: 'UNSUBSCRIBED',
      // trigger_automation: false
    },
    sx()
  );
  logger.info('Sender: unsubscribe', { data: res.data });
  return res.data;
}

/** Update fields / groups (GLOBAL) */
export async function senderUpdateSubscriber(email: string, vars: Record<string, any> = {}) {
  const enc = encodeURIComponent(normalizeEmail(email));
  const payload: any = {};
  if (vars.firstname) payload.firstname = vars.firstname;
  if (vars.lastname) payload.lastname = vars.lastname;
  if (vars.fields) payload.fields = vars.fields;         // {"{$key}":"value"}
  if (vars.groups) payload.groups = vars.groups;         // ["groupId1","groupId2"]

  const res = await axios.patch(`https://api.sender.net/v2/subscribers/${enc}`, payload, sx());
  logger.info('Sender: update', { data: res.data });
  return res.data;
}

/** Check status (GLOBAL) */
export async function senderCheckSubscriptionStatus(email: string): Promise<{
  exists: boolean;
  status: 'subscribed' | 'unsubscribed' | 'unknown';
  transactional?: 'active' | 'unsubscribed' | 'unknown';
  raw?: any;
}> {
  try {
    const sub = await senderGetSubscriber(email);
    const d = sub?.data ?? {};
    const { marketing, transactional } = extractStatuses(d);
    return {
      exists: !!d?.email,
      status: marketing === 'ACTIVE' ? 'subscribed'
            : marketing === 'UNSUBSCRIBED' ? 'unsubscribed'
            : 'unknown',
      transactional: transactional === 'ACTIVE' ? 'active'
                   : transactional === 'UNSUBSCRIBED' ? 'unsubscribed'
                   : 'unknown',
      raw: d
    };
  } catch (e: any) {
    if (e.response?.status === 404) return { exists: false, status: 'unknown', transactional: 'unknown' };
    throw e;
  }
}
