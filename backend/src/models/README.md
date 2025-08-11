# Models Architecture

## Models

### PendingUser
- **Purpose**: Stores user registration data before email verification and payment completion
- **Fields**: email, username, passwordHash, name, levelKey, expiresAt
- **TTL Index**: Automatically expires after 24 hours
- **Usage**: Created during registration, deleted after successful verification/payment

### User
- **Purpose**: Core user account data after successful verification
- **Fields**: email, username, passwordHash, name, role
- **Indexes**: email (unique), username (unique)
- **Usage**: Main user account after email verification

## CheckoutSession Architecture

The new architecture separates concerns between user registration data and payment session tracking:

### Models

#### PendingUser
- **Purpose**: Stores user registration data (email, username, password, etc.)
- **Lifecycle**: Created during registration → Deleted after successful payment
- **Fields**: email, username, passwordHash, name, levelKey, expiresAt

#### CheckoutSession  
- **Purpose**: Tracks each Stripe checkout attempt
- **Lifecycle**: CREATED → COMPLETED → (deleted)
- **Fields**: pendingUserId, stripeSessionId, status, createdAt, expiresAt

#### User
- **Purpose**: Permanent user account after successful payment
- **Lifecycle**: Created by webhook after payment confirmation
- **Fields**: email, username, passwordHash, name, role

### Flow

1. **Registration**: Create PendingUser + CheckoutSession
2. **Checkout**: Update CheckoutSession with Stripe session ID
3. **Webhook**: Mark CheckoutSession COMPLETED, create User, delete both PendingUser and CheckoutSession
4. **Verification**: Check CheckoutSession status to determine if payment processed

### Benefits

- **Separation of Concerns**: User data vs payment tracking
- **Better Auditing**: Can scan checkout_sessions for stuck payments
- **Clear Lifecycle**: Discrete state machine (CREATED → COMPLETED)
- **TTL Cleanup**: Auto-expire sessions at MongoDB level
- **Idempotency**: Safe to re-run webhook processing