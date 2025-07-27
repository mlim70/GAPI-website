# Stripe Checkout Testing Guide

This guide covers testing all the scenarios you mentioned for the Stripe checkout flow.

## 🚀 Quick Start

### 1. Ensure Servers Are Running
- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- Stripe CLI: `stripe listen --forward-to localhost:4000/api/stripe/webhook`

### 2. Test the Complete Flow
1. Go to `http://localhost:5173/become-member`
2. Select a membership level
3. Fill out the registration form
4. Click "Proceed to Payment"
5. Use test card: `4242 4242 4242 4242`
6. Complete payment and verify success

## 🧪 Test Scenarios

### Scenario 1: Success Path
```bash
stripe trigger checkout.session.completed
```
**Expected Behavior:**
- ✅ Webhook promotes PendingUser → User
- ✅ Creates Subscription record
- ✅ Creates Order record
- ✅ Deletes PendingUser
- ✅ Front-end polling succeeds and redirects

### Scenario 2: Failure Path
```bash
stripe trigger payment_intent.payment_failed
```
**Expected Behavior:**
- ❌ Payment fails gracefully
- ❌ User sees error message
- ❌ No user account created

### Scenario 3: Duplicate Event (Idempotency)
```bash
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed
```
**Expected Behavior:**
- ✅ First event processes normally
- ✅ Second event early-returns (already processed)
- ✅ No duplicate users or subscriptions created

### Scenario 4: Signature Mismatch
**How to simulate:**
1. Change `STRIPE_WEBHOOK_SECRET` in your `.env` file
2. Run: `stripe trigger checkout.session.completed`

**Expected Behavior:**
- ❌ Returns 400 response
- ❌ User not created
- ❌ Error logged

### Scenario 5: Long Webhook Delay
**How to simulate:**
1. Add this line to `backend/src/routes/stripeWebhook.ts` in the `checkout.session.completed` case:
   ```javascript
   await new Promise(r => setTimeout(r, 8000));
   ```
2. Complete a checkout flow

**Expected Behavior:**
- ⏳ Front-end spinner shows for 8+ seconds
- ✅ Eventually succeeds when webhook completes

### Scenario 6: Network Drop
**How to simulate:**
1. Start webhook listener: `stripe listen --forward-to localhost:4000/api/stripe/webhook`
2. Complete a checkout
3. Kill the stripe listen process
4. Restart the listener

**Expected Behavior:**
- ⏳ Stripe dashboard shows "Retrying"
- ✅ Upon restart, event delivered and handled idempotently

## 📋 Automated Testing

### Run All Test Scenarios
```bash
node test-stripe-scenarios.js
```

### Test Signature Mismatch
```bash
node test-signature-mismatch.js
```

## 🔍 Monitoring and Debugging

### Backend Logs
Watch for these log messages:
- `🔔 Webhook received`
- `✅ Webhook signature verified`
- `💰 Processing checkout.session.completed`
- `🔄 Event already processed - user exists with session ID`
- `✅ Idempotency check passed - skipping duplicate processing`
- `✅ Real user created`
- `✅ Subscription created/updated`
- `✅ Order created`
- `🗑️ Pending user deleted`

### Front-end Polling
The success page polls `/api/stripe/checkout/verify-session`:
- Returns `{ ready: false }` while webhook is processing
- Returns `{ ready: true, token, user }` when complete

### Database Verification
Check these collections after successful payment:
- `users` - Should have new user with `stripeSessionId`
- `subscriptions` - Should have active subscription
- `orders` - Should have completed order
- `pendingusers` - Should be empty (deleted)

## 🛠️ Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check if `stripe listen` is running
   - Verify webhook endpoint URL is correct
   - Check firewall/network settings

2. **Signature verification fails**
   - Ensure `STRIPE_WEBHOOK_SECRET` is correct
   - Check if webhook secret matches Stripe dashboard

3. **User not created after payment**
   - Check webhook logs for errors
   - Verify PendingUser exists before payment
   - Check database connection

4. **Front-end stuck on loading**
   - Check if backend is running
   - Verify session ID is being passed correctly
   - Check network requests in browser dev tools

### Environment Variables Required
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

## 📊 Test Data

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

### Test Scenarios
- **3D Secure**: `4000 0025 0000 3155`
- **International**: `4000 0000 0000 3063`

## 🎯 What to Break on Purpose

| Scenario | How to Simulate | Expected Behavior |
|----------|----------------|-------------------|
| Duplicate event | `stripe trigger checkout.session.completed` twice | Second POST should early-return (already processed) |
| Signature mismatch | Change `STRIPE_WEBHOOK_SECRET` locally | 400 response, user not created |
| Long webhook delay | Add `await new Promise(r=>setTimeout(r, 8000))` | Front-end spinner shows until ready, then succeeds |
| Network drop | Kill stripe listen tunnel | Stripe dashboard shows Retrying; upon restart, event delivered and handled idempotently |

## 🚀 Next Steps

1. **Test the complete flow** using the test card
2. **Run automated tests** with the provided scripts
3. **Monitor logs** to verify webhook processing
4. **Check database** to confirm user creation and subscription setup
5. **Test edge cases** using the scenarios above

The system is now ready for comprehensive testing of all Stripe checkout scenarios! 