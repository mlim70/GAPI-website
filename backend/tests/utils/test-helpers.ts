import { Request } from 'express';
import Stripe from 'stripe';

export interface TestUserData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  levelKey: string;
  profilePic?: Express.Multer.File;
}

export interface TestMembershipLevel {
  key: string;
  name: string;
  description?: string;
  stripePriceId: string;
  isRecurring: boolean;
  unitAmount: number;
  currency: string;
  interval?: string;
}

export const createTestUserData = (overrides: Partial<TestUserData> = {}): TestUserData => ({
  email: `test-${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  levelKey: 'basic',
  ...overrides,
});

export const createTestMembershipLevel = (overrides: Partial<TestMembershipLevel> = {}): TestMembershipLevel => ({
  key: `basic-${Date.now()}`,
  name: 'Basic Membership',
  description: 'Basic membership level',
  stripePriceId: `price_basic${Date.now()}`,
  isRecurring: true,
  unitAmount: 1999, // $19.99
  currency: 'usd',
  interval: 'month',
  ...overrides,
});

export const createMockStripeSession = (overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session => ({
  id: 'cs_test_session_123',
  object: 'checkout.session',
  amount_total: 1999,
  currency: 'usd',
  customer: 'cus_test_123',
  customer_details: {
    email: 'test@example.com',
    name: 'Test User',
  },
  metadata: {
    pendingUserId: '507f1f77bcf86cd799439011',
    levelKey: 'basic',
  },
  payment_intent: 'pi_test_123',
  payment_status: 'paid',
  status: 'complete',
  subscription: 'sub_test_123',
  created: Math.floor(Date.now() / 1000),
  ...overrides,
} as Stripe.Checkout.Session);

export const createMockStripeEvent = (
  eventType: string,
  sessionData: Partial<Stripe.Checkout.Session> = {}
): Stripe.Event => ({
  id: 'evt_test_123',
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: createMockStripeSession(sessionData),
  },
  livemode: false,
  pending_webhooks: 0,
  request: {
    id: 'req_test_123',
    idempotency_key: null,
  },
  type: eventType,
} as Stripe.Event);

export const createMockRequest = (body: any = {}, headers: any = {}): Partial<Request> => ({
  body,
  headers: {
    'content-type': 'application/json',
    ...headers,
  },
});

export const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'profilePic',
  originalname: 'test-avatar.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  destination: '/tmp',
  filename: 'test-avatar.jpg',
  path: '/tmp/test-avatar.jpg',
  buffer: Buffer.from('fake-image-data'),
  stream: undefined,
  ...overrides,
} as Express.Multer.File);

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateRandomId = () => Math.random().toString(36).substring(2, 15);

export const createTestDatabase = async () => {
  // This would be used for integration tests with a real database
  // For now, we'll use the mocked setup
}; 