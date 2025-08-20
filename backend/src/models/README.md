# Models Architecture

## Models

### User
- **Purpose**: Core user account data
- **Fields**: email, username, passwordHash, name, emailVerified, verificationTokenHash, verificationTokenExpires, signupIntent
- **Indexes**: email (unique), username (unique)
- **Usage**: Main user account created during registration with emailVerified: false

## CheckoutSession Architecture

The new architecture creates users immediately and tracks payment sessions separately:

### Models

#### User
- **Purpose**: Stores user registration data immediately upon registration
- **Lifecycle**: Created during registration (emailVerified: false) → Verified via email → Payment processed via webhook
- **Fields**: email, username, passwordHash, name, emailVerified, verificationTokenHash, verificationTokenExpires, signupIntent

#### CheckoutSession  
- **Purpose**: Simple tracking of Stripe checkout sessions
- **Lifecycle**: CREATED → COMPLETED
- **Fields**: userId, stripeSessionId, levelKey, status, expiresAt

### Flow

1. **Registration**: Create User immediately with emailVerified: false and verification token
2. **Email Verification**: User verifies email, token is cleared, user can proceed to checkout
3. **Checkout**: Create CheckoutSession linked to verified User
4. **Webhook**: Mark CheckoutSession COMPLETED, update User membershipLevel via webhook handlers
5. **Cleanup**: Delete CheckoutSession after successful processing

### Benefits

- **Immediate User Creation**: Users exist in the system from the start
- **Better User Experience**: No intermediate "pending" state
- **Clearer Flow**: Registration → Verification → Payment → Membership
- **Webhook-Driven**: Membership levels set by payment webhooks, not during registration
- **Audit Trail**: Full user history from registration through payment