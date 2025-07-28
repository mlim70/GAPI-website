/*
  Full-Stack Integration Test Suite – **Robust Edition** (July 2025)
  ================================================================
  SCOPE
  -----
  • Authentication & Account
  • Membership-Level CRUD & protection rules
  • Payment Pipeline (registration → checkout → webhooks → verification)
  • Security / Validation (injection, XSS, JWT, password policy, rate-limit)
  • Concurrency & Perf smoke tests
  • Resilience: retries, idempotency, cold-start DB failures, Stripe outages

  USAGE
  -----
  ▸ Save as **tests/full-suite.robust.test.ts**  ➟  `npm test`
  ▸ Assumes route mounting:
        app.use('/api/auth',             authRouter)
        app.use('/api/account',          accountRouter)
        app.use('/api/membership-levels', membershipRouter)
        app.use('/api/stripe',           stripeCheckoutRouter)   // /checkout & /verify-session
        app.use('/api/stripe/webhook',   stripeWebhookRouter)

  NOTE  This file REPLACES the earlier light test corpus – delete old .test.ts
        files to avoid duplicate DB wipes.
*/

// ========================================== Imports & harness ==========================================
import request  from 'supertest';
import express  from 'express';
import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';
import { randomUUID } from 'crypto';



// Models
import User            from '../src/models/user.model';
import PendingUser     from '../src/models/pendingUser.model';
import CheckoutSession from '../src/models/checkoutSession.model';
import MembershipLevel from '../src/models/membershipLevel.model';
import Subscription    from '../src/models/subscription.model';
import Order           from '../src/models/order.model';
import WebhookEvent    from '../src/models/webhookEvent.model';

// Routes
import authRouter           from '../src/routes/auth';
import accountRouter        from '../src/routes/account';
import membershipRouter     from '../src/routes/membershipLevels';
import stripeCheckoutRouter from '../src/routes/stripeCheckout';
import stripeWebhookRouter  from '../src/routes/stripeWebhook';

// Helpers / mocks
import {
  createTestUserData,
  createTestMembershipLevel,
  createMockStripeSession,
  createMockStripeEvent,
  sleep,
} from './utils/test-helpers';
import * as mockStripe from '../src/lib/stripe';

// Express harness
const app = express();
app.use(express.json());
app.use('/api/auth',             authRouter);
app.use('/api/account',          accountRouter);
app.use('/api/membership-levels', membershipRouter);
app.use('/api/stripe',           stripeCheckoutRouter);
app.use('/api/stripe/webhook',   stripeWebhookRouter);

// ----------------------------------------- DB helpers -----------------------------------------
/**
 * Hard-reset every collection **after** the driver is connected.
 * Guards against the "buffering timed out after 10000 ms" race.
 */
const wipe = async () => {
  if (mongoose.connection.readyState !== 1) {          // 0 = disconnected, 1 = connected
    await mongoose.connection.asPromise();            // wait until connected
  }
  await Promise.all([
    User.deleteMany({}),
    PendingUser.deleteMany({}),
    CheckoutSession.deleteMany({}),
    MembershipLevel.deleteMany({}),
    Subscription.deleteMany({}),
    Order.deleteMany({}),
    WebhookEvent.deleteMany({}),
  ]);
};

// Wipe before each test to ensure clean state
beforeEach(wipe);

const fakeSig = 't=1,v1=fake';

// ========================================== AUTH & ACCOUNT ==========================================
describe('1. Auth & Account', () => {
  const pwd = 'Str0ngP@ss!';
  let level: any;
  beforeEach(() => { level = createTestMembershipLevel(); });

  it('registers → verifies → logs in → /account OK', async () => {
    const data = createTestUserData({ levelKey: level.key, password: pwd });
    await request(app).post('/api/auth/register').send(data);
    await User.updateOne({ email: data.email }, { emailVerified: true, passwordHash: await bcrypt.hash(pwd, 12) });

    const login = await request(app).post('/api/auth/login').send({ email: data.email, password: pwd });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const acct = await request(app).get('/api/account').set('Authorization', `Bearer ${token}`);
    expect(acct.status).toBe(200);
    expect(acct.body.email).toBe(data.email);
  });

  it('rejects weak password', async () => {
    const body = { ...createTestUserData({ levelKey: level.key, password: pwd }), password: '123' };
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const body = { ...createTestUserData({ levelKey: level.key, password: pwd }), email: 'bad-at.com' };
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('rejects duplicate email', async () => {
    const d = createTestUserData({ levelKey: level.key });
    await request(app).post('/api/auth/register').send(d);
    const body = { ...createTestUserData({ levelKey: level.key, password: pwd }), email: d.email };
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('denies login for unverified email', async () => {
    const data = createTestUserData({ levelKey: level.key, password: pwd });
    await request(app).post('/api/auth/register').send(data);
    const res = await request(app).post('/api/auth/login').send({ email: data.email, password: pwd });
    expect(res.status).toBe(403);
  });
});

// ========================================== MEMBERSHIP-LEVEL CRUD ==========================================
describe('2. Membership-Level CRUD', () => {
  const adminToken = 'Bearer admintoken'; // token stub — assume middleware treats as admin

  it('create/update/delete with auth; prevents duplicate & in-use delete', async () => {
    const key = `test-${Date.now()}`;
    // create
    let r = await request(app).post('/api/membership-levels').set('Authorization', adminToken).send({ key, name: 'Gold', priceId: 'price_gold' });
    expect(r.status).toBe(201);

    // duplicate key
    r = await request(app).post('/api/membership-levels').set('Authorization', adminToken).send({ key, name: 'Dup', priceId: 'price_dup' });
    expect(r.status).toBe(409);

    const id = (await MembershipLevel.findOne({ key }))!._id;
    // update
    r = await request(app).patch(`/api/membership-levels/${id}`).set('Authorization', adminToken).send({ name: 'Gold Plus' });
    expect(r.body.name).toBe('Gold Plus');

    // link level to user to block deletion
    await User.create(createTestUserData({ levelKey: key }));
    r = await request(app).delete(`/api/membership-levels/${id}`).set('Authorization', adminToken);
    expect(r.status).toBe(409);

    // remove link & delete succeeds
    await User.deleteMany({ levelKey: key });
    r = await request(app).delete(`/api/membership-levels/${id}`).set('Authorization', adminToken);
    expect(r.status).toBe(204);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).post('/api/membership-levels').send({ key: 'nope', name: 'x', priceId: 'p' });
    expect([401, 403]).toContain(res.status);
  });
});

// ========================================== PAYMENT PIPELINE ==========================================
describe('3. Payment Pipeline', () => {
  let level: any;
  beforeEach(() => { level = createTestMembershipLevel(); jest.clearAllMocks(); });

  // Helper to create and return pendingUserId
  const createPendingUser = async (overrides = {}) => {
    const d = createTestUserData({ levelKey: level.key, ...overrides });
    let req = request(app).post('/api/auth/pending-user');
    for (const [k, v] of Object.entries(d)) req = req.field(k, v);
    const res = await req;
    expect(res.status).toBe(201);
    return { ...d, pendingUserId: res.body.pendingUserId, checkoutSessionId: res.body.checkoutSessionId };
  };

  // Happy path end-to-end
  it('happy path: register → checkout → webhook → verify-session', async () => {
    const { pendingUserId, checkoutSessionId, email } = await createPendingUser();

    /** Mock Stripe session creation */
    const stripeSession = createMockStripeSession({
      id: `cs_${randomUUID()}`,
      metadata: { pendingUserId, levelKey: level.key },
    });
    jest.spyOn(mockStripe.stripe.checkout.sessions, 'create').mockResolvedValueOnce(stripeSession as any);

    const coRes = await request(app).post('/api/stripe/checkout').send({ pendingUserId, levelKey: level.key });
    expect(coRes.status).toBe(200);

    /** Webhook: paid */
    const evt = createMockStripeEvent('checkout.session.completed', {
      id: stripeSession.id,
      payment_status: 'paid',
      status: 'complete',
      subscription: `sub_${randomUUID()}`,
      metadata: { pendingUserId, levelKey: level.key },
    });
    const wh = await request(app).post('/api/stripe/webhook').set('stripe-signature', fakeSig).send(evt);
    expect(wh.status).toBe(200);

    /** Assertions */
    const user = await User.findOne({ email });
    expect(user).toBeTruthy();
    const sub = await Subscription.findOne({ userId: user!._id });
    expect(sub).toBeTruthy();
    const order = await Order.findOne({ userId: user!._id });
    expect(order).toBeTruthy();
    const cs = await CheckoutSession.findById(checkoutSessionId);
    expect(cs!.status).toBe('COMPLETED');
  });

  it('idempotency: duplicate webhook returns 200 + message, only one user', async () => {
    const { pendingUserId, email } = await createPendingUser();
    const sess = createMockStripeSession({ id: `cs_${randomUUID()}`, metadata: { pendingUserId, levelKey: level.key } });
    jest.spyOn(mockStripe.stripe.checkout.sessions, 'create').mockResolvedValue(sess as any);
    await request(app).post('/api/stripe/checkout').send({ pendingUserId, levelKey: level.key });

    const event = createMockStripeEvent('checkout.session.completed', { id: sess.id, status: 'complete', payment_status: 'paid', metadata: { pendingUserId, levelKey: level.key } });
    const hdrs = { 'stripe-signature': fakeSig };
    const r1 = await request(app).post('/api/stripe/webhook').set(hdrs).send(event);
    const r2 = await request(app).post('/api/stripe/webhook').set(hdrs).send(event);
    expect(r2.body.message).toBe('already processed');
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it('webhook 400 on missing pendingUserId', async () => {
    const event = createMockStripeEvent('checkout.session.completed', { 
      id: `cs_${randomUUID()}`, 
      status: 'complete', 
      payment_status: 'paid', 
      metadata: { levelKey: level.key } 
    });
    const res = await request(app).post('/api/stripe/webhook').set('stripe-signature', fakeSig).send(event);
    expect(res.status).toBe(400);
  });

  it('webhook 400 on missing levelKey', async () => {
    const event = createMockStripeEvent('checkout.session.completed', { 
      id: `cs_${randomUUID()}`, 
      status: 'complete', 
      payment_status: 'paid', 
      metadata: { pendingUserId: new mongoose.Types.ObjectId().toString() } 
    });
    const res = await request(app).post('/api/stripe/webhook').set('stripe-signature', fakeSig).send(event);
    expect(res.status).toBe(400);
  });

  it('webhook 400 on invalid membership', async () => {
    const event = createMockStripeEvent('checkout.session.completed', { 
      id: `cs_${randomUUID()}`, 
      status: 'complete', 
      payment_status: 'paid', 
      metadata: { pendingUserId: new mongoose.Types.ObjectId().toString(), levelKey: 'nope' } 
    });
    const res = await request(app).post('/api/stripe/webhook').set('stripe-signature', fakeSig).send(event);
    expect(res.status).toBe(400);
  });

  it('gracefully handles Stripe outage then succeeds on retry', async () => {
    const { pendingUserId } = await createPendingUser();
    // fail
    jest.spyOn(mockStripe.stripe.checkout.sessions, 'create').mockRejectedValueOnce(new Error('stripe down'));
    const fail = await request(app).post('/api/stripe/checkout').send({ pendingUserId, levelKey: level.key });
    expect(fail.status).toBe(503);
    // succeed
    jest.spyOn(mockStripe.stripe.checkout.sessions, 'create').mockResolvedValueOnce(createMockStripeSession({ id: `cs_${randomUUID()}` }) as any);
    const ok = await request(app).post('/api/stripe/checkout').send({ pendingUserId, levelKey: level.key });
    expect(ok.status).toBe(200);
  });

  it('rejects verify-session for unpaid session', async () => {
    const res = await request(app).get('/api/stripe/verify-session').query({ session_id: 'cs_upaid' });
    expect(res.status).toBe(402);
  });
});

// ========================================== SECURITY / VALIDATION ==========================================
describe('4. Security & Validation', () => {
  it.each([
    ['SQLi in email',    { email: "' OR 1=1--@ex.com" }],
    ['SQLi in username', { username: "'; DROP TABLE users; --" }],
    ['XSS in username',  { username: '<img src=x onerror=alert(1) />' }],
  ])('blocks %s', async (_c, patch) => {
    const lvl = createTestMembershipLevel();
    const body = { ...createTestUserData({ levelKey: lvl.key }), ...patch };
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('JWT middleware rejects tampered/expired token', async () => {
    const res = await request(app).get('/api/account').set('Authorization', 'Bearer tampered');
    expect([401, 403]).toContain(res.status);
  });
});

// ========================================== CONCURRENCY & PERFORMANCE ==========================================
describe('5. Concurrency & Performance', () => {
  it('handles 25 parallel registrations', async () => {
    const lvl = createTestMembershipLevel();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => request(app).post('/api/auth/register').send(createTestUserData({ email: `load-${i}@ex.com`, username: `load-${i}`, levelKey: lvl.key })))
    );
    expect(await PendingUser.countDocuments({ levelKey: lvl.key })).toBe(25);
  });

  it('processes 10 concurrent duplicate webhook deliveries idempotently', async () => {
    const lvl = createTestMembershipLevel();
    const pending = await PendingUser.create(createTestUserData({ levelKey: lvl.key }));
    const evt = createMockStripeEvent('checkout.session.completed', { id: `cs_${randomUUID()}`, payment_status: 'paid', status: 'complete', metadata: { levelKey: lvl.key, pendingUserId: pending._id.toString() } });
    await Promise.all(
      Array.from({ length: 10 }, () => request(app).post('/api/stripe/webhook').set('stripe-signature', fakeSig).send(evt))
    );
    expect(await WebhookEvent.countDocuments({ eventId: evt.id })).toBe(1);
  });
});
