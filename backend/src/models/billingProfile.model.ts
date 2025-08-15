import mongoose, { Schema, Types, Document, Model } from 'mongoose';

export interface IBillingProfile extends Document {
  /* Optional: the app user who "owns" the billing profile (payer). 
     You can keep this null if payers aren't accounts in your app. */
  ownerUserId?: Types.ObjectId | null;

  // The Stripe Customer that represents the billing party
  stripeCustomerId?: string | null;

  // Contact info for invoices/receipts (kept in sync with Stripe)
  email?: string | null;
  name?: string | null;

  // Soft-dedupe helpers
  normalizedEmail?: string | null;
}

const billingProfileSchema = new Schema<IBillingProfile>({
  ownerUserId:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
  stripeCustomerId:{ type: String, default: null },
  email:           { type: String, default: null },
  name:            { type: String, default: null },
  normalizedEmail: { type: String, default: null },
}, { timestamps: true, autoIndex: false });

billingProfileSchema.pre('save', function(next) {
  if (this.email) this.normalizedEmail = this.email.trim().toLowerCase();
  next();
});

// Keep normalizedEmail in sync on updates too
billingProfileSchema.pre('findOneAndUpdate', function(next) {
  const u: any = this.getUpdate();
  const email = u?.$set?.email ?? u?.email;
  if (typeof email === 'string') {
    const norm = email.trim().toLowerCase();
    if (u.$set) u.$set.normalizedEmail = norm;
    else this.setUpdate({ ...u, normalizedEmail: norm });
  }
  next();
});

const BillingProfile: Model<IBillingProfile> = mongoose.model('BillingProfile', billingProfileSchema);
export default BillingProfile;
