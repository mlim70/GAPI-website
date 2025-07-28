import { Request } from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import PendingUser from '../../src/models/pendingUser.model';
import CheckoutSession from '../../src/models/checkoutSession.model';
import User from '../../src/models/user.model';
import Subscription from '../../src/models/subscription.model';
import Order from '../../src/models/order.model';
import WebhookEvent from '../../src/models/webhookEvent.model';

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

export interface DatabaseStateSnapshot {
  pendingUsers: any[];
  checkoutSessions: any[];
  users: any[];
  subscriptions: any[];
  orders: any[];
  webhookEvents: any[];
  stepName: string;
  timestamp: Date;
}

export interface ExpectedDatabaseState {
  pendingUsers?: number;
  checkoutSessions?: number;
  users?: number;
  subscriptions?: number;
  orders?: number;
  webhookEvents?: number;
}

export interface PipelineStep {
  name: string;
  action: () => Promise<any>;
  expectedDatabaseState: ExpectedDatabaseState;
  failureSimulation?: () => Promise<void>;
  recoveryAction?: () => Promise<any>;
}

export class DatabaseStateVerifier {
  private snapshots: DatabaseStateSnapshot[] = [];

  async captureSnapshot(stepName: string): Promise<DatabaseStateSnapshot> {
    const snapshot: DatabaseStateSnapshot = {
      pendingUsers: await PendingUser.find({}).lean(),
      checkoutSessions: await CheckoutSession.find({}).lean(),
      users: await User.find({}).lean(),
      subscriptions: await Subscription.find({}).lean(),
      orders: await Order.find({}).lean(),
      webhookEvents: await WebhookEvent.find({}).lean(),
      stepName,
      timestamp: new Date(),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  async verifySnapshot(expectedState: ExpectedDatabaseState, stepName: string): Promise<void> {
    const actualSnapshot = await this.captureSnapshot(stepName);
    
    if (expectedState.pendingUsers !== undefined) {
      expect(actualSnapshot.pendingUsers.length).toBe(expectedState.pendingUsers);
    }
    if (expectedState.checkoutSessions !== undefined) {
      expect(actualSnapshot.checkoutSessions.length).toBe(expectedState.checkoutSessions);
    }
    if (expectedState.users !== undefined) {
      expect(actualSnapshot.users.length).toBe(expectedState.users);
    }
    if (expectedState.subscriptions !== undefined) {
      expect(actualSnapshot.subscriptions.length).toBe(expectedState.subscriptions);
    }
    if (expectedState.orders !== undefined) {
      expect(actualSnapshot.orders.length).toBe(expectedState.orders);
    }
    if (expectedState.webhookEvents !== undefined) {
      expect(actualSnapshot.webhookEvents.length).toBe(expectedState.webhookEvents);
    }

    console.log(`✅ Database state verification passed for: ${stepName}`);
  }

  getSnapshots(): DatabaseStateSnapshot[] {
    return this.snapshots;
  }

  clearSnapshots(): void {
    this.snapshots = [];
  }
}

export class FailureSimulator {
  private originalFunctions: Map<string, any> = new Map();

  async simulateStripeAPIFailure(): Promise<void> {
    const mockStripe = await import('../../src/lib/stripe');
    this.originalFunctions.set('stripe.checkout.sessions.create', mockStripe.stripe.checkout.sessions.create);
    (mockStripe.stripe.checkout.sessions.create as jest.MockedFunction<any>).mockRejectedValue(new Error('Stripe API Unavailable'));
  }

  async simulateDatabaseConnectionFailure(): Promise<void> {
    const originalConnect = mongoose.connect;
    this.originalFunctions.set('mongoose.connect', originalConnect);
    mongoose.connect = jest.fn().mockRejectedValue(new Error('Database Connection Failed'));
  }

  async simulateS3UploadFailure(): Promise<void> {
    const mockFileUpload = await import('../../src/utils/fileUpload');
    this.originalFunctions.set('uploadFileToS3', mockFileUpload.uploadFileToS3);
    (mockFileUpload.uploadFileToS3 as jest.MockedFunction<any>).mockRejectedValue(new Error('S3 Upload Failed'));
  }

  async simulateWebhookSignatureFailure(): Promise<void> {
    // This would be handled by the webhook verification middleware
    // We can simulate it by providing invalid signature
  }

  async simulateTimeoutFailure(timeoutMs: number = 100): Promise<void> {
    const mockStripe = await import('../../src/lib/stripe');
    this.originalFunctions.set('stripe.checkout.sessions.create', mockStripe.stripe.checkout.sessions.create);
    (mockStripe.stripe.checkout.sessions.create as jest.MockedFunction<any>).mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request Timeout')), timeoutMs);
      });
    });
  }

  async restoreOriginalFunctions(): Promise<void> {
    const mockStripe = await import('../../src/lib/stripe');
    const mockFileUpload = await import('../../src/utils/fileUpload');

    if (this.originalFunctions.has('stripe.checkout.sessions.create')) {
      mockStripe.stripe.checkout.sessions.create = this.originalFunctions.get('stripe.checkout.sessions.create');
    }
    if (this.originalFunctions.has('uploadFileToS3')) {
      mockFileUpload.uploadFileToS3 = this.originalFunctions.get('uploadFileToS3');
    }
    if (this.originalFunctions.has('mongoose.connect')) {
      mongoose.connect = this.originalFunctions.get('mongoose.connect');
    }

    this.originalFunctions.clear();
  }
}

export class PipelineTestScenario {
  private steps: PipelineStep[] = [];
  private verifier: DatabaseStateVerifier;
  private failureSimulator: FailureSimulator;

  constructor() {
    this.verifier = new DatabaseStateVerifier();
    this.failureSimulator = new FailureSimulator();
  }

  addStep(step: PipelineStep): void {
    this.steps.push(step);
  }

  async runScenario(scenarioName: string): Promise<void> {
    console.log(`\n🚀 Running Scenario: ${scenarioName}`);
    console.log('='.repeat(50));

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`\n📝 Step ${i + 1}: ${step.name}`);

      try {
        // Run the main action
        const result = await step.action();
        
        // Verify database state
        await this.verifier.verifySnapshot(step.expectedDatabaseState, step.name);
        
        console.log(`✅ Step ${i + 1} completed successfully`);
        
        // If there's a failure simulation, run it
        if (step.failureSimulation) {
          console.log(`🔄 Simulating failure for step ${i + 1}`);
          await step.failureSimulation();
          
          // Run recovery action if provided
          if (step.recoveryAction) {
            console.log(`🔄 Running recovery action for step ${i + 1}`);
            await step.recoveryAction();
            await this.verifier.verifySnapshot(step.expectedDatabaseState, `${step.name} (After Recovery)`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed:`, error);
        throw error;
      }
    }

    console.log(`\n✅ Scenario "${scenarioName}" completed successfully`);
  }

  getVerifier(): DatabaseStateVerifier {
    return this.verifier;
  }

  getFailureSimulator(): FailureSimulator {
    return this.failureSimulator;
  }
}

export const createTestUserData = (overrides: Partial<TestUserData> = {}): TestUserData => ({
  email: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@example.com`,
  username: `testuser${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  levelKey: 'basic',
  ...overrides,
});

export const createTestMembershipLevel = (overrides: Partial<TestMembershipLevel> = {}): TestMembershipLevel => ({
  key: 'basic',
  name: 'Basic Membership',
  description: 'Basic membership level',
  stripePriceId: 'price_basic123',
  isRecurring: true,
  unitAmount: 1999, // $19.99
  currency: 'usd',
  interval: 'month',
  ...overrides,
});

export const createMockStripeSession = (overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session => ({
  id: `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  object: 'checkout.session',
  amount_total: 1999,
  currency: 'usd',
  customer: `cus_test_${Date.now()}`,
  customer_details: {
    email: 'test@example.com',
    name: 'Test User',
  },
  metadata: {
    pendingUserId: '507f1f77bcf86cd799439011',
    levelKey: 'basic',
  },
  payment_intent: `pi_test_${Date.now()}`,
  payment_status: 'paid',
  status: 'complete',
  subscription: `sub_test_${Date.now()}`,
  created: Math.floor(Date.now() / 1000),
  ...overrides,
} as Stripe.Checkout.Session);

export const createMockStripeEvent = (
  eventType: string,
  sessionData: Partial<Stripe.Checkout.Session> = {}
): Stripe.Event => ({
  id: `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: createMockStripeSession(sessionData),
  },
  livemode: false,
  pending_webhooks: 0,
  request: {
    id: `req_test_${Date.now()}`,
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
  originalname: 'avatar.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  destination: '/tmp',
  filename: 'avatar.jpg',
  path: '/tmp/avatar.jpg',
  buffer: Buffer.from('fake-image-data'),
  ...overrides,
} as Express.Multer.File);

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateRandomId = () => Math.random().toString(36).substring(2, 15);

export const createTestDatabase = async () => {
  // This function can be used to set up a test database with specific data
  const testData = {
    membershipLevels: [
      createTestMembershipLevel({ key: 'basic', name: 'Basic Plan' }),
      createTestMembershipLevel({ key: 'premium', name: 'Premium Plan', unitAmount: 2999 }),
    ],
  };

  return testData;
};

export const validateUserData = (user: any, expectedData: TestUserData): void => {
  expect(user.email).toBe(expectedData.email);
  expect(user.username).toBe(expectedData.username);
  expect(user.name.first).toBe(expectedData.firstName);
  expect(user.name.last).toBe(expectedData.lastName);
  expect(user.role).toBe('subscriber');
};

export const validateSubscriptionData = (subscription: any, expectedData: any): void => {
  expect(subscription.gateway).toBe('stripe');
  expect(subscription.status).toBe('ACTIVE');
  expect(subscription.gatewaySubId).toBeTruthy();
  expect(subscription.startDate).toBeTruthy();
};

export const validateOrderData = (order: any, expectedData: any): void => {
  expect(order.gateway).toBe('stripe');
  expect(order.amount).toBeTruthy();
  expect(order.currency).toBe('usd');
};

export const validateWebhookEvent = (webhookEvent: any, expectedEventType: string): void => {
  expect(webhookEvent.eventType).toBe(expectedEventType);
          expect(webhookEvent.eventId).toBeTruthy();
  expect(webhookEvent.processed).toBe(true);
}; 