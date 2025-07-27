// backend/src/utils/syncStripeMemberships.ts
import Stripe from 'stripe';
import mongoose from 'mongoose';
import MembershipLevel from '../models/membershipLevel.model.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function syncMembershipLevels() {
  // fetch all active prices and expand their product data
  const prices = await stripe.prices.list({
    active: true,
    expand: ['data.product'],
  });

  for (const price of prices.data) {
    const product = price.product as Stripe.Product;
    await MembershipLevel.findOneAndUpdate(
      { stripePriceId: price.id },
      {
        key:           product.metadata.key || product.id,
        name:          product.name,
        description:   product.description || undefined,
        stripePriceId: price.id,
        isRecurring:   price.type === 'recurring',
      },
      { upsert: true, new: true }
    );
  }

  // optionally: remove any local docs whose stripePriceId no longer exists
  const stripeIds = new Set(prices.data.map(p => p.id));
  await MembershipLevel.deleteMany({ stripePriceId: { $nin: [...stripeIds] } });
}