# Happy-Path Checkout Test Guide

## Prerequisites

1. **Backend Server Running**: Make sure your backend is running on `http://localhost:4000`
2. **Frontend Server Running**: Make sure your frontend is running on `http://localhost:3000`
3. **Stripe Configuration**: Ensure you have valid Stripe test keys in your `.env` file
4. **Database**: MongoDB should be running and connected
5. **Membership Levels**: At least one membership level should exist in the database

## Test Steps

### 1. Navigate to Become Member Page
- Open your browser and go to `http://localhost:3000/become-a-member`
- You should see a list of available membership levels

### 2. Test API Endpoint Directly
You can test the checkout API directly using curl or Postman:

```bash
curl -X POST http://localhost:4000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "levelKey": "your-membership-level-key",
    "userId": "demo-user-id"
  }'
```

Expected response:
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

### 3. Complete Checkout Flow
1. Click on any membership level card on the Become Member page
2. You'll be redirected to Stripe Checkout
3. Use the test card: `4242 4242 4242 4242`
4. Use any future expiry date (e.g., 12/25)
5. Use any 3-digit CVC (e.g., 123)
6. Complete the payment

### 4. Verify Success
- After successful payment, you'll be redirected to `/stripe/success`
- Check your database to verify:
  - A new `Subscription` record was created
  - A new `Order` record was created
  - The subscription status is `ACTIVE`

### 5. Test Cancel Flow
- Start the checkout process again
- Click "Cancel" on the Stripe Checkout page
- You should be redirected to `/stripe/cancel`

## Expected Database Records

After a successful checkout, you should see:

### Subscription Record
```json
{
  "userId": "demo-user-id",
  "levelId": "membership-level-id",
  "gateway": "stripe",
  "gatewaySubId": "sub_...",
  "status": "ACTIVE",
  "startDate": "2024-01-01T00:00:00.000Z"
}
```

### Order Record
```json
{
  "membershipLevelId": "membership-level-id",
  "total": 29.99,
  "currency": "USD",
  "gatewayPaymentId": "pi_...",
  "status": "COMPLETED",
  "paidAt": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Common Issues

1. **"Level not found" error**
   - Check that membership levels exist in your database
   - Run the sync script: `npm run sync:stripe`

2. **Stripe checkout fails**
   - Verify your Stripe keys are correct
   - Check that the price IDs exist in Stripe

3. **Webhook not working**
   - Ensure your webhook endpoint is accessible
   - Check webhook signature verification

4. **CORS errors**
   - Verify the frontend is making requests to the correct backend URL
   - Check CORS configuration in the backend

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MONGODB_URI=mongodb://localhost:27017/gapi
DOMAIN=http://localhost:3000
``` 