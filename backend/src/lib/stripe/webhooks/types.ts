// backend/src/lib/stripe/webhooks/types.ts
import Stripe from 'stripe';

/**
 * Webhook event handler function type
 */
export type WebhookEventHandler = (event: Stripe.Event) => Promise<void>;

/**
 * Webhook event types
 */
export type WebhookEventType = 
  | 'checkout.session.completed'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'charge.refunded'
  | 'charge.dispute.closed'
  | 'price.updated'
  | 'price.deleted'
  | 'product.updated'
  | 'product.deleted';

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  created: number;
  data: {
    object: Stripe.Event.Data;
  };
}

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: WebhookEventType;
  processingTime: number;
  error?: string;
}

/**
 * Typed Stripe event objects for better type safety
 */
export type StripeSubscriptionEvent = Stripe.Event & {
  data: {
    object: Stripe.Subscription;
  };
};

export type StripeInvoiceEvent = Stripe.Event & {
  data: {
    object: Stripe.Invoice;
  };
};

export type StripePaymentIntentEvent = Stripe.Event & {
  data: {
    object: Stripe.PaymentIntent;
  };
};

export type StripeCheckoutSessionEvent = Stripe.Event & {
  data: {
    object: Stripe.Checkout.Session;
  };
};

export type StripeCustomerEvent = Stripe.Event & {
  data: {
    object: Stripe.Customer;
  };
};

export type StripeChargeEvent = Stripe.Event & {
  data: {
    object: Stripe.Charge;
  };
};

export type StripeDisputeEvent = Stripe.Event & {
  data: {
    object: Stripe.Dispute;
  };
};

export type StripePriceEvent = Stripe.Event & {
  data: {
    object: Stripe.Price;
  };
};

export type StripeProductEvent = Stripe.Event & {
  data: {
    object: Stripe.Product;
  };
};
