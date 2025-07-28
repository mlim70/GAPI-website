# Membership Update Verification Guide

## Overview
This document outlines what fields should be updated in your MongoDB database when a user changes their membership plan, and how to verify that all updates are working correctly.

## Database Fields That Should Be Updated

### 1. Subscription Model (`subscriptions` collection)

**Fields Updated During Plan Change:**
- `levelId` - References the new membership level
- `status` - Should remain 'ACTIVE' for plan changes
- `nextBillDate` - Updated to reflect the new billing cycle
- `startDate` - Should remain unchanged (original subscription start)
- `cancelDate` - Should remain null for plan changes

**Fields That Should NOT Change:**
- `userId` - Should remain the same user
- `gateway` - Should remain 'stripe'
- `gatewaySubId` - Should remain the same Stripe subscription ID

### 2. User Model (`users` collection)

**Fields That Should NOT Change During Plan Change:**
- All user fields remain unchanged during plan changes
- `stripeSessionId` - May be updated for new checkout sessions
- `role` - Should remain 'subscriber'

### 3. Order Model (`orders` collection)

**New Order Created For Plan Change:**
- `userId` - References the user
- `membershipLevelId` - References the new membership level
- `gatewayPaymentId` - New payment intent ID
- `totalCents` - Amount for the plan change
- `currency` - Payment currency
- `status` - Should be 'COMPLETED'
- `paidAt` - Timestamp of payment

## Webhook Events That Handle Updates

### 1. `checkout.session.completed`
**Triggers:** New registration OR plan change
**Updates:**
- Creates/updates Subscription record
- Creates new Order record
- Updates User.stripeSessionId

### 2. `customer.subscription.updated`
**Triggers:** Plan change in Stripe
**Updates:**
- Updates Subscription.levelId
- Updates Subscription.nextBillDate
- Updates Subscription.status

### 3. `invoice.payment_succeeded`
**Triggers:** Successful recurring payment
**Updates:**
- Updates Subscription.nextBillDate
- Ensures Subscription.status is 'ACTIVE'

## Verification Script

Run the verification script to check your database:

```bash
npm run verify:membership
```

This script will:
1. ✅ Check all users with subscriptions
2. ✅ Verify subscription data integrity
3. ✅ Check for orphaned subscriptions
4. ✅ Verify membership level references
5. ✅ Check for multiple active subscriptions
6. ✅ Validate required fields

## Expected Database State After Plan Change

### Before Plan Change:
```
User: {
  _id: "user123",
  email: "user@example.com",
  role: "subscriber"
}

Subscription: {
  userId: "user123",
  levelId: "basic_plan",
  status: "ACTIVE",
  gatewaySubId: "sub_stripe123",
  startDate: "2024-01-01",
  nextBillDate: "2024-02-01"
}
```

### After Plan Change:
```
User: {
  _id: "user123",
  email: "user@example.com",
  role: "subscriber"  // Unchanged
}

Subscription: {
  userId: "user123",  // Unchanged
  levelId: "premium_plan",  // Updated
  status: "ACTIVE",  // Unchanged
  gatewaySubId: "sub_stripe123",  // Unchanged
  startDate: "2024-01-01",  // Unchanged
  nextBillDate: "2024-02-01"  // Updated to new billing cycle
}

Order: {
  userId: "user123",
  membershipLevelId: "premium_plan",
  gatewayPaymentId: "pi_new_payment",
  totalCents: 5000,
  status: "COMPLETED",
  paidAt: "2024-01-15"
}
```

## Common Issues to Check

### 1. Missing Fields
- ❌ Subscription without levelId
- ❌ Subscription without userId
- ❌ Order without membershipLevelId

### 2. Data Inconsistency
- ❌ Multiple active subscriptions for same user
- ❌ Orphaned subscriptions (no user)
- ❌ Invalid membership level references

### 3. Timing Issues
- ❌ Subscription updated before payment confirmed
- ❌ Order created without corresponding subscription update

## Testing Plan Changes

### 1. Test Plan Change Flow:
1. Log in as existing user
2. Go to "Become a Member" page
3. Select a different plan
4. Complete checkout
5. Verify webhook events are received
6. Run verification script

### 2. Check Webhook Logs:
```bash
# Check webhook events in Stripe Dashboard
# Or use Stripe CLI locally:
stripe listen --forward-to localhost:4000/api/stripe/webhook
```

### 3. Verify Database Updates:
```bash
npm run verify:membership
```

## Troubleshooting

### If Verification Fails:

1. **Check Webhook Events:**
   - Verify `customer.subscription.updated` events are being received
   - Check webhook signature verification

2. **Check Database Connections:**
   - Ensure MongoDB connection is stable
   - Verify environment variables

3. **Check Stripe Integration:**
   - Verify Stripe API keys
   - Check webhook endpoint configuration

4. **Review Logs:**
   - Check backend logs for webhook processing errors
   - Verify event processing order

## Manual Database Queries

### Check User's Current Subscription:
```javascript
db.subscriptions.findOne(
  { userId: ObjectId("user_id_here"), status: "ACTIVE" }
)
```

### Check User's Order History:
```javascript
db.orders.find(
  { userId: ObjectId("user_id_here") }
).sort({ createdAt: -1 })
```

### Check for Data Issues:
```javascript
// Multiple active subscriptions
db.subscriptions.aggregate([
  { $match: { status: "ACTIVE" } },
  { $group: { _id: "$userId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
``` 