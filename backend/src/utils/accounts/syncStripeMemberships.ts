// backend/src/utils/accounts/syncStripeMemberships.ts
import Stripe from 'stripe';
import mongoose from 'mongoose';
import MembershipLevel from '../../models/membershipLevel.model';
import { stripe } from '../../lib/stripe/client';
import { logger } from '../general/logger';

export async function syncMembershipLevels() {
  // 1) fetch all active prices and expand their product data
  const resp = await stripe.prices.list({
    active: true,
    expand: ['data.product'],
  });

  // 2) only keep those whose product is active
  const activePrices = resp.data.filter(p => (p.product as Stripe.Product).active);

  for (const price of activePrices) {
    const product = price.product as Stripe.Product;
    
    // Generate a key from product name or fallback to product ID
    const key = product.name || `product_${product.id}`;
    
    try {
      // Upsert by stripePriceId - this is our primary identifier
      const result = await MembershipLevel.findOneAndUpdate(
        { stripePriceId: price.id },
        {
          stripeProductId: product.id,
          key:              key,
          description:      product.description || undefined,
          isRecurring:      price.type === 'recurring',
          unitAmount:       price.unit_amount || 0,
          currency:         price.currency,
          interval:         price.recurring?.interval || undefined,
          intervalCount:    price.recurring?.interval_count || undefined,
          status:           'ACTIVE',
        },
        { upsert: true, new: true, runValidators: true }
      );
      
      if (result) {
        logger.info('✅ Synced membership level:', { 
          priceId: price.id, 
          productId: product.id, 
          key: key
        });
      }
    } catch (err) {
      logger.error(`Error syncing MembershipLevel for stripePriceId: ${price.id}`, err);
    }
  }

  // 3) Archive any local docs not in our filtered list instead of deleting them
  const stripePriceIds = new Set(activePrices.map(p => p.id));
  try {
    const result = await MembershipLevel.updateMany(
      { stripePriceId: { $nin: [...stripePriceIds] } },
      { $set: { status: 'ARCHIVED' } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`📦 Archived ${result.modifiedCount} outdated membership levels (preserving historical data)`);
    }
  } catch (err) {
    logger.error('Error archiving outdated membership levels', err);
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
      // For deleted prices, archive the membership level instead of deleting
      try {
        const result = await MembershipLevel.findOneAndUpdate(
          { stripePriceId: price.id },
          { $set: { status: 'ARCHIVED' } },
          { new: true }
        );
        if (result) {
          logger.info('📦 Archived membership level for removed price:', price.id);
        }
      } catch (err) {
        logger.error(`Error archiving membership level for price: ${price.id}`, err);
      }
      return;
      
    case 'product.created':
    case 'product.updated':
      product = event.data.object as Stripe.Product;
      
      // Check if product is active
      if (!product.active) {
        logger.info(`📦 Product "${product.name}" is archived, archiving membership levels`);
        try {
          const result = await MembershipLevel.updateMany(
            { stripeProductId: product.id },
            { $set: { status: 'ARCHIVED' } }
          );
          if (result.modifiedCount > 0) {
            logger.info(`✅ Archived ${result.modifiedCount} membership level(s) for archived product: ${product.name}`);
          }
        } catch (err) {
          logger.error(`Error archiving membership levels for archived product: ${product.name}`, err);
        }
        return;
      }
      
      // For active products, fetch associated prices
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });
      
      // Sync all prices for this product
      for (const price of prices.data) {
        await upsertMembershipLevel(price, product);
      }
      return;
      
    case 'product.deleted': {
      // note: the deleted Product object comes in as { id, object: 'product', deleted: true }
      const deletedProduct = event.data.object as unknown as Stripe.DeletedProduct;
      // Archive by product ID instead of deleting
      try {
        const result = await MembershipLevel.updateMany(
          { stripeProductId: deletedProduct.id },
          { $set: { status: 'ARCHIVED' } }
        );
        
        logger.info(
          `📦 product.deleted: archived ${result.modifiedCount} level(s)` +
          ` for product ID "${deletedProduct.id}"`
        );
      } catch (err) {
        logger.error(`Error archiving membership levels for deleted product: ${deletedProduct.id}`, err);
      }
      return;
    }
      
    default:
      logger.debug('Unhandled event type for membership sync:', event.type);
      return;
  }

  // Upsert the single membership level
  await upsertMembershipLevel(price, product);
}

// Helper function to upsert a single membership level
async function upsertMembershipLevel(price: Stripe.Price, product: Stripe.Product) {
  
  const key = product.name || `product_${product.id}`;
  
  try {
    // Upsert by stripePriceId - this is our primary identifier
    const result = await MembershipLevel.findOneAndUpdate(
      { stripePriceId: price.id },
      {
        stripeProductId: product.id,
        key:              key,
        description:      product.description || undefined,
        isRecurring:      price.type === 'recurring',
        unitAmount:       price.unit_amount || 0,
        currency:         price.currency,
        interval:         price.recurring?.interval || undefined,
        intervalCount:    price.recurring?.interval_count || undefined,
        status:           'ACTIVE', // Ensure synced levels are marked as active
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    if (result) {
      logger.info('Membership level synced:', { 
        priceId: price.id, 
        productId: product.id, 
        key: key
      });
    }
  } catch (err) {
    logger.error(`Error syncing membership level for price: ${price.id}`, err);
  }
}