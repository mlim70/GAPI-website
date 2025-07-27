# Models Overview

## **User**
Stores user account information and authentication details.

**Fields:**
- `email`: string (required, unique, validated) - must be valid email format
- `username`: string (required, unique, 3-30 chars) - user's display name
- `passwordHash`: string (required, bcrypt hashed) - encrypted password
- `name`: {
  - `first`: string (required, 1-50 chars) - user's first name
  - `last`: string (required, 1-50 chars) - user's last name
}
- `avatarUrl?`: string (optional, validated) - must be valid HTTP/HTTPS URL
- `role`: 'subscriber' | 'administrator' (default: 'subscriber')
- `createdAt`: Date (auto-generated via timestamps)
- `updatedAt`: Date (auto-updated via timestamps)

**Notes:**
- **E-1**: Removed `membershipLevel` field - membership status now derived from Subscription model
- **E-2**: Switched to `{ timestamps: true }` for automatic date handling
- **G-2**: Added comprehensive field validation (email, URL, length limits)

---

## **MembershipLevel**
Defines membership plan options with cached Stripe pricing data.

**Fields:**
- `key`: string (required, unique, 1-50 chars) - e.g., "life", "student", "professional"
- `name`: string (required, 1-100 chars) - from Stripe.Product.name
- `description?`: string (optional, max 500 chars) - from Stripe.Product.description
- `stripePriceId`: string (required, unique, validated) - must match Stripe price format
- `isRecurring`: boolean (required) - whether this is a subscription or one-time payment
- `unitAmount`: number (required, integer, min 0) - price in cents
- `currency`: string (required, 3-letter ISO, default: 'usd') - e.g., 'usd', 'eur'
- `interval?`: string (optional, validated) - 'day', 'week', 'month', 'year' for recurring plans
- `status`: 'ACTIVE' | 'ARCHIVED' (default: 'ACTIVE', indexed)
- `createdAt`: Date (auto-generated via timestamps)
- `updatedAt`: Date (auto-updated via timestamps)

**Notes:**
- **M-1**: Added cached Stripe pricing fields to avoid extra API calls
- **M-2**: Added status enum to support retiring plans
- **M-3**: Enabled timestamps for consistent auditing
- **G-2**: Added validation for Stripe IDs, currency codes, and amounts

---

## **Subscription**
Represents a user's active membership subscription.

**Fields:**
- `userId`: ObjectId (required, ref: 'User', indexed) - user who owns the subscription
- `levelId`: ObjectId (required, ref: 'MembershipLevel', indexed) - membership level
- `gateway`: 'stripe' | 'paypal' (required) - payment gateway (future-proofed)
- `gatewaySubId`: string (required, unique, indexed) - gateway subscription ID
- `status`: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' (required)
- `startDate`: Date (required) - when subscription became active
- `nextBillDate?`: Date (optional) - next billing date for recurring subscriptions
- `cancelDate?`: Date (optional) - when subscription was cancelled
- `createdAt`: Date (auto-generated via timestamps)
- `updatedAt`: Date (auto-updated via timestamps)

**Notes:**
- **S-1**: Removed `orderCount` field - derive from Order aggregation when needed
- **S-2**: Extended gateway enum to include 'paypal'
- **G-1**: Enabled timestamps for consistent auditing
- Created automatically when Stripe webhook receives `checkout.session.completed`
- Supports recurring billing through Stripe subscriptions
- Status updates via Stripe webhooks

---

## **Order**
Records individual payment transactions for memberships.

**Fields:**
- `userId`: ObjectId (required, ref: 'User', indexed) - user who made the purchase
- `subscriptionId?`: ObjectId (optional, ref: 'Subscription', indexed) - linked subscription
- `membershipLevelId`: ObjectId (required, ref: 'MembershipLevel', indexed) - membership level purchased
- `gatewayPaymentId`: string (required, unique, indexed, validated) - must match Stripe payment format
- `totalCents`: number (required, integer, min 0) - payment amount in cents
- `currency`: string (required, 3-letter ISO, validated) - e.g., 'usd', 'eur'
- `billing`: {
  - `name`: string (required, 1-100 chars) - customer's full name
  - `email`: string (required, validated) - must be valid email format
  - `phone?`: string (optional, validated) - must be valid phone format
  - `address?`: {
    - `line1`: string (optional, max 100 chars)
    - `city`: string (optional, max 50 chars)
    - `region`: string (optional, max 50 chars)
    - `postalCode`: string (optional, max 20 chars)
    - `country`: string (optional, max 50 chars)
  }
}
- `status`: 'COMPLETED' | 'FAILED' | 'REFUNDED' (required)
- `paidAt`: Date (required) - when payment was completed
- `refundedAt?`: Date (optional) - when refund was processed
- `createdAt`: Date (auto-generated via timestamps)
- `updatedAt`: Date (auto-updated via timestamps)

**Notes:**
- **O-1**: Added `userId` for direct user linkage and one-time purchases
- **O-2**: Changed `total` to `totalCents` to avoid floating-point precision issues
- **O-3**: Enabled timestamps for consistent auditing
- **G-2**: Added comprehensive validation for all fields
- Created automatically when Stripe webhook receives `checkout.session.completed`
- Supports both subscription payments and one-time purchases
- Billing information captured during Stripe checkout process

---

## **Key Changes Summary**

### **E-1**: User Model - Removed membershipLevel
- Membership status now derived from Subscription model
- Eliminates data drift between User and Subscription
- Use Subscription.findOne({ userId, status: 'ACTIVE' }) to get current membership

### **M-1**: MembershipLevel - Cached Stripe Pricing
- Added `unitAmount`, `currency`, `interval` fields
- Reduces Stripe API calls for price display
- Must be kept in sync with Stripe pricing changes

### **S-2**: Subscription - Multi-Gateway Support
- Extended gateway enum to include 'paypal'
- Future-proofs for additional payment processors

### **O-2**: Order - Integer Cents Storage
- Changed from `total` (float) to `totalCents` (integer)
- Eliminates floating-point precision issues
- Frontend should convert to display format (e.g., $19.99)

### **G-1**: Global - Timestamps Everywhere
- All models now use `{ timestamps: true }`
- Consistent createdAt/updatedAt handling
- Automatic date management

### **G-2**: Global - Field Validation
- Email validation on all email fields
- Currency validation (3-letter ISO codes)
- Money validation (integer cents only)
- Stripe ID format validation
- Length limits on string fields

---

## **Payment Flow**

1. **User selects membership level** → Frontend calls `/api/stripe/checkout`
2. **Stripe creates checkout session** → Returns checkout URL
3. **User completes payment** → Stripe processes payment
4. **Webhook received** → `checkout.session.completed` event
5. **Database updated** → Creates/updates Subscription and Order records
6. **User redirected** → Success page with confirmation

## **Webhook Events Handled**

- `checkout.session.completed` - Creates subscription and order
- `invoice.payment_failed` - Updates subscription status
- `customer.subscription.deleted` - Cancels subscription
- `product.updated/created` - Syncs membership levels
- `price.updated/created/deleted` - Syncs membership levels

## **Migration Notes**

See `DENORMALIZATION_RULES.md` for detailed migration guidelines and sync rules.