# Stripe Checkout Testing Guide

## Setup Instructions

### 1. Start Stripe Webhook Listener
```bash
stripe listen --forward-to localhost:4000/api/stripe/webhook
```

### 2. Test the Complete Flow

#### Step 1: Create Checkout Session
1. Navigate to `http://localhost:5173/become-a-member`
2. Select a membership level
3. Fill out the registration form
4. Click "Proceed to Payment"
5. You'll be redirected to Stripe Checkout

#### Step 2: Complete Payment
Use the canonical test card:
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any valid ZIP code

#### Step 3: Verify Success Flow
1. After payment, you'll be redirected to `/stripe/success`
2. The page will poll the backend until the webhook processes
3. Once ready, you'll be logged in and redirected

## Test Scenarios

### 1. Success Path (Normal Flow)
```bash
# Trigger a successful checkout completion
stripe trigger checkout.session.completed
```
**Expected Behavior:**
- Webhook should promote PendingUser → User
- Create Subscription record
- Create Order record
- Delete PendingUser
- Front-end polling should succeed and redirect

### 2. Failure Path
```bash
# Trigger a payment failure
stripe trigger payment_intent.payment_failed
```
**Expected Behavior:**
- Payment should fail gracefully
- User should see error message
- No user account should be created

### 3. Duplicate Event (Idempotency Test)
```bash
# Trigger the same event twice
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed
```
**Expected Behavior:**
- First event should process normally
- Second event should early-return (already processed)
- No duplicate users or subscriptions created

### 4. Signature Mismatch Test
**How to simulate:**
1. Change `STRIPE_WEBHOOK_SECRET` in your `.env` file
2. Trigger an event: `stripe trigger checkout.session.completed`

**Expected Behavior:**
- Should return 400 response
- User should not be created
- Error should be logged

### 5. Long Webhook Delay Test
**How to simulate:**
1. Add this line to the webhook handler in `backend/src/routes/stripeWebhook.ts`:
   ```javascript
   await new Promise(r => setTimeout(r, 8000));
   ```
2. Complete a checkout flow

**Expected Behavior:**
- Front-end spinner should show for 8+ seconds
- Eventually succeeds when webhook completes

### 6. Network Drop Test
**How to simulate:**
1. Start webhook listener: `stripe listen --forward-to localhost:4000/api/stripe/webhook`
2. Complete a checkout
3. Kill the stripe listen process
4. Restart the listener

**Expected Behavior:**
- Stripe dashboard shows "Retrying"
- Upon restart, event should be delivered and handled idempotently

## Monitoring and Debugging

### Check Webhook Logs
The backend logs will show detailed webhook processing:
- `🔔 Webhook received`
- `✅ Webhook signature verified`
- `💰 Processing checkout.session.completed`
- `✅ Real user created`
- `✅ Subscription created/updated`
- `✅ Order created`
- `🗑️ Pending user deleted`

### Check Front-end Polling
The success page polls `/api/stripe/checkout/verify-session` until ready:
- Returns `{ ready: false }` while webhook is processing
- Returns `{ ready: true, token, user }` when complete

### Database Verification
Check these collections after successful payment:
- `users` - Should have new user with `stripeSessionId`
- `subscriptions` - Should have active subscription
- `orders` - Should have completed order
- `pendingusers` - Should be empty (deleted)

## Troubleshooting

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

## Test Data

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

### Test Scenarios
- **3D Secure**: `4000 0025 0000 3155`
- **International**: `4000 0000 0000 3063` 