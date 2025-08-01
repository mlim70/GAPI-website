# Production-Grade Email Verification Workflow

This document outlines the secure, production-ready email verification system implemented for GAPI's paid membership funnel.

## Overview

The workflow follows a 6-phase approach that separates user registration from payment processing, ensuring security and preventing duplicate registrations.

## Phase 1: Registration → PendingUser

**Purpose**: Collect minimal data and keep it separate from the real users table until payment succeeds.

### Key Implementation Details

- **Model**: `PendingUser` with TTL index on `expiresAt`
- **Required Fields**: email, username, passwordHash, levelKey
- **Expiration**: 24 hours from creation
- **Database Hygiene**: TTL index automatically cleans up expired records

```typescript
// PendingUser Schema
{
  email: String, // normalized, unique
  username: String, // normalized, unique  
  passwordHash: String,
  name: { first: String, last: String },
  levelKey: String,
  expiresAt: Date, // TTL index: 24h
  emailVerified: Boolean, // default: false
  emailVerificationTokenHash: String, // SHA-256 hash
  emailVerificationTokenExpires: Date
}
```

### Security Features

- Email and username normalization prevents duplicates
- TTL index automatically removes stale data
- Separate from User table prevents analytics contamination

## Phase 2: Send Verification Email

**Purpose**: Prove inbox ownership before creating Stripe session.

### Implementation

- **Token Generation**: 256-bit random → SHA-256 hash stored in DB
- **URL Format**: `https://yourapp.com/email-verification?token=<tok>&pendingUserId=<id>`
- **Rate Limiting**: 5 requests per 15 minutes per IP
- **HTTPS Enforcement**: All links use HTTPS in production

### Email Template Features

- Professional HTML template with GAPI branding
- Clear call-to-action button
- Security warnings and expiration notice
- Fallback plain text link

## Phase 3: Click Link → /api/auth/verify-email

**Purpose**: Verify email and prepare for checkout.

### Security Guards

```typescript
// Crucial validation checks
if (!pending.emailVerified && pending.expiresAt < now) {
  return res.status(400).json({ 
    message: 'Registration expired',
    code: 'REGISTRATION_EXPIRED' 
  });
}
```

### Implementation Details

- **Single Use**: Token immediately nulled after verification
- **Rate Limiting**: 5 requests per 15 minutes per IP
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Expiration Extension**: Verified users get +24h to complete payment
- **Error Codes**: Specific error codes for better UX

## Phase 4: Checkout

**Purpose**: Create Stripe session only for verified, non-expired users.

### Validation Logic

```typescript
// Check if email is verified before allowing checkout
if (!pendingUser.emailVerified) {
  return res.status(403).json({ 
    message: 'Please verify your e-mail before proceeding to payment.' 
  });
}

// Check if pending user has expired
if (pendingUser.expiresAt < new Date()) {
  return res.status(400).json({ 
    message: 'Pending user has expired' 
  });
}
```

### Stripe Session Metadata

```typescript
const session = await stripe.checkout.sessions.create({
  metadata: {
    pendingUserId: pendingUser._id.toString(),
    levelKey,
  },
  client_reference_id: pendingUserId,
  // ... other config
});
```

## Phase 5: Stripe Webhook

**Purpose**: Payment succeeded → atomically create User and clean up.

### Atomic Operations

```typescript
// 1. Create User from PendingUser data
const user = await User.create({
  email: pendingUser.email,
  username: pendingUser.username,
  passwordHash: pendingUser.passwordHash,
  name: pendingUser.name,
  role: 'subscriber',
  membershipLevel: pendingUser.levelKey
});

// 2. Create subscription and order records
const subscription = await Subscription.create({...});
const order = await Order.create({...});

// 3. Clean up pending data
await CheckoutSession.findOneAndUpdate(
  { pendingUserId: pendingUser._id },
  { status: 'COMPLETED' }
);
await PendingUser.findByIdAndDelete(pendingUser._id);
```

### Benefits

- **Duplicate Prevention**: PendingUser deletion prevents duplicate registrations
- **Idempotency**: Safe to re-run webhook processing
- **Audit Trail**: Complete payment and user creation history

## Phase 6: Resend Link (Optional)

**Purpose**: Allow users to request new verification links.

### Security Features

- **Rate Limiting**: 3 requests per 15 minutes (stricter than verify)
- **No Information Leakage**: Always returns 204 status
- **Token Rotation**: Each resend generates fresh token
- **Expiration Check**: Prevents resending to expired registrations

```typescript
// Always return 204 to prevent information leakage
if (!pending || pending.emailVerified || pending.expiresAt < new Date()) {
  return res.status(204).send();
}
```

## Security & UX Checklist

### ✅ Implemented

- **Single Use Tokens**: Immediately nulled after verification
- **HTTPS Everywhere**: All links use HTTPS in production
- **Hash Storage**: Only SHA-256 hashes stored in database
- **Token Rotation**: Fresh tokens on each resend
- **Soft Delete Behavior**: Deleted PendingUsers naturally fail verification
- **Graceful Errors**: Frontend handles expired links with clear messaging
- **Rate Limiting**: Protection against abuse
- **Security Headers**: XSS, clickjacking, and MIME type protection
- **Error Sanitization**: No internal details leaked in production

### Timing Guidelines

| Scenario | TTL | Rationale |
|----------|-----|-----------|
| Email Verification | 24 hours | Sweet spot for paid membership - long enough for timezone differences, short enough for auto-cleanup |
| Password Reset | 10-30 min | High-risk action, short window reduces hijack surface |
| Marketing Opt-in | 7-14 days | No security impact, compliance focus |

## Error Handling

### Backend Error Codes

- `LINK_EXPIRED`: Token invalid or expired
- `REGISTRATION_EXPIRED`: PendingUser expired (24h from creation)
- `EMAIL_ALREADY_VERIFIED`: Attempt to verify already verified email

### Frontend UX

- **Expired Link Page**: Clear messaging with resend option
- **Success Feedback**: Visual confirmation for resend operations
- **Loading States**: Proper loading indicators during verification
- **Error Recovery**: Easy path back to registration

## Monitoring & Debugging

### Key Metrics to Track

- Verification success/failure rates
- Resend request frequency
- Expired registration cleanup
- Webhook processing success rates

### Debug Endpoints

- `/api/auth/verify-email` - Test verification flow
- `/api/auth/resend-verification` - Test resend functionality
- Webhook event logging for payment processing

## Production Deployment Checklist

- [ ] Environment variables configured (JWT_SECRET, STRIPE_KEYS, etc.)
- [ ] HTTPS enforced in production
- [ ] Rate limiting enabled
- [ ] TTL indexes created on MongoDB
- [ ] Email service configured (Sender.net)
- [ ] Webhook endpoints registered with Stripe
- [ ] Error monitoring configured
- [ ] Database backups scheduled

## Testing Scenarios

1. **Normal Flow**: Registration → Email → Verification → Checkout → Payment → User Created
2. **Expired Link**: Click expired verification link → Clear error message
3. **Resend Flow**: Request new verification → Fresh token generated
4. **Duplicate Prevention**: Attempt duplicate registration → Proper error handling
5. **Rate Limiting**: Exceed rate limits → 429 responses
6. **Webhook Retry**: Failed webhook → Idempotent retry processing

This workflow ensures both security and user experience while maintaining clean data hygiene and preventing common attack vectors. 