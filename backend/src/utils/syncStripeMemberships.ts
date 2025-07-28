// backend/src/utils/syncStripeMemberships.ts
import Stripe from 'stripe';
import mongoose from 'mongoose';
import MembershipLevel from '@models/membershipLevel.model';
import { stripe } from '@lib/stripe';

export async function syncMembershipLevels() {
  // fetch all active prices and expand their product data
  const prices = await stripe.prices.list({
    active: true,
    expand: ['data.product'],
  });

  for (const price of prices.data) {
    const product = price.product as Stripe.Product;
    try {
      const result = await MembershipLevel.findOneAndUpdate(
        { stripePriceId: price.id },
        {
          key:           product.metadata.key || product.id,
          name:          product.name,
          description:   product.description || undefined,
          stripePriceId: price.id,
          isRecurring:   price.type === 'recurring',
          unitAmount:    price.unit_amount || 0,
          currency:      price.currency,
          interval:      price.recurring?.interval || undefined,
          intervalCount: price.recurring?.interval_count || undefined,
        },
        { upsert: true, new: true }
      );
      if (!result) {
        console.warn('⚠️ Failed to create/update MembershipLevel for stripePriceId:', price.id);
      } else {
        console.log('✅ MembershipLevel synced:', result._id);
      }
    } catch (err) {
      console.error('❌ Error syncing MembershipLevel for stripePriceId:', price.id, err);
    }
  }

  // optionally: remove any local docs whose stripePriceId no longer exists
  const stripeIds = new Set(prices.data.map(p => p.id));
  try {
    const result = await MembershipLevel.deleteMany({ stripePriceId: { $nin: [...stripeIds] } });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Deleted ${result.deletedCount} outdated membership levels`);
    }
  } catch (err) {
    console.error('❌ Error deleting outdated membership levels:', err);
  }
}

// Function to sync a single price from webhook event
export async function syncSingleMembershipLevel(event: Stripe.Event) {
  let price: Stripe.Price;
  let product: Stripe.Product;

  // Extract price and product from different event types
  switch (event.type) {
    case 'price.created':
    case 'price.updated':
      price = event.data.object as Stripe.Price;
      // For price events, we need to fetch the product separately
      const productData = await stripe.products.retrieve(price.product as string);
      product = productData;
      break;
      
    case 'price.deleted':
      price = event.data.object as Stripe.Price;
      // For deleted prices, just remove the membership level
      try {
        const result = await MembershipLevel.findOneAndDelete({ stripePriceId: price.id });
        if (result) {
          console.log('🗑️ Deleted membership level for removed price:', price.id);
        }
      } catch (err) {
        console.error('❌ Error deleting membership level for price:', price.id, err);
      }
      return;
      
    case 'product.created':
    case 'product.updated':
      product = event.data.object as Stripe.Product;
      // For product events, we need to fetch associated prices
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });
      
      // Sync all prices for this product
      for (const price of prices.data) {
        await upsertMembershipLevel(price, product);
      }
      return;
      
    default:
      console.log('⚠️ Unhandled event type for membership sync:', event.type);
      return;
  }

  // Upsert the single membership level
  await upsertMembershipLevel(price, product);
}

// Helper function to upsert a single membership level
async function upsertMembershipLevel(price: Stripe.Price, product: Stripe.Product) {
  try {
    const result = await MembershipLevel.findOneAndUpdate(
      { stripePriceId: price.id },
      {
        key:           product.metadata.key || product.id,
        name:          product.name,
        description:   product.description || undefined,
        stripePriceId: price.id,
        isRecurring:   price.type === 'recurring',
        unitAmount:    price.unit_amount || 0,
        currency:      price.currency,
        interval:      price.recurring?.interval || undefined,
        intervalCount: price.recurring?.interval_count || undefined,
      },
      { upsert: true, new: true }
    );
    
    if (result) {
      console.log('✅ Membership level synced:', result.name, `(${price.id})`);
    } else {
      console.log('⚠️ Failed to sync membership level for price:', price.id);
    }
  } catch (err) {
    console.error('❌ Error syncing membership level for price:', price.id, err);
  }
}