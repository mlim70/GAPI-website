# Models Overview

**User**
- Stores user account information.
- *Fields:*
email: string;
username: string;
passwordHash: string;
name: {
  first: string;
  last: string;
};
avatarUrl?: string;
role: 'subscriber' | 'administrator';
createdAt: Date;
updatedAt: Date;

**MembershipLevel**
- Defines membership plan options.
- *Fields:*
key: string;
name: string;
price: number;
currency: string;
interval?: {
  unit: 'MINUTE' | 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';
  count: number;
};
isRecurring: boolean;
createdAt: Date;
updatedAt: Date;

**Subscription**
- Represents a user's membership subscription.
- *Fields:*
userId: ObjectId;
levelId: ObjectId;
gatewaySubId: string; // paypal gateway ID
status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
startDate: Date;
nextBillDate?: Date;
cancelDate?: Date;
orderCount: number;
createdAt: Date;
updatedAt: Date;

**Order (previously named Payment)**
- Records payment transactions for subscriptions.
- *Fields:*
subscriptionId?: ObjectId; //Nullable for one-time purchases
gatewayPaymentId: string;
total: number;
currency: string;
billing: {
  name: string;
  email: string;
  phone?: string;  // optional but useful
  address?: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
};
status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
paidAt: Date;
refundedAt?: Date;
createdAt: Date;
updatedAt: Date;