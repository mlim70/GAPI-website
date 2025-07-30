// backend/scripts/debugStripeSync.ts
import 'dotenv/config';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import MembershipLevel from '../src/models/membershipLevel.model';
import { stripe } from '../src/lib/stripe';

async function debugStripeSync() {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Fetch all active prices and expand their product data
    console.log('\n=== STRIPE PRICES ===');
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    console.log(`Total active prices: ${prices.data.length}`);

    // Group prices by product name to identify duplicates
    const pricesByProductName = new Map<string, Stripe.Price[]>();
    
    for (const price of prices.data) {
      const product = price.product as Stripe.Product;
      const productName = product.name || 'UNNAMED_PRODUCT';
      
      if (!pricesByProductName.has(productName)) {
        pricesByProductName.set(productName, []);
      }
      pricesByProductName.get(productName)!.push(price);
    }

    // Check for products with multiple prices
    console.log('\n=== PRODUCTS WITH MULTIPLE PRICES ===');
    for (const [productName, prices] of pricesByProductName.entries()) {
      if (prices.length > 1) {
        console.log(`\nProduct: "${productName}" has ${prices.length} prices:`);
        prices.forEach(price => {
          console.log(`  - Price ID: ${price.id}`);
          console.log(`    Type: ${price.type}`);
          console.log(`    Amount: ${price.unit_amount} ${price.currency}`);
          if (price.recurring) {
            console.log(`    Recurring: ${price.recurring.interval_count} ${price.recurring.interval}`);
          }
        });
      }
    }

    // Check current membership levels
    console.log('\n=== CURRENT MEMBERSHIP LEVELS ===');
    const membershipLevels = await MembershipLevel.find({});
    console.log(`Total membership levels: ${membershipLevels.length}`);
    
    const levelsByKey = new Map<string, any[]>();
    for (const level of membershipLevels) {
      if (!levelsByKey.has(level.key)) {
        levelsByKey.set(level.key, []);
      }
      levelsByKey.get(level.key)!.push(level);
    }

    // Check for duplicate keys
    console.log('\n=== DUPLICATE KEYS IN DATABASE ===');
    for (const [key, levels] of levelsByKey.entries()) {
      if (levels.length > 1) {
        console.log(`\nKey: "${key}" has ${levels.length} entries:`);
        levels.forEach(level => {
          console.log(`  - ID: ${level._id}`);
          console.log(`    Price ID: ${level.stripePriceId}`);
          console.log(`    Created: ${(level as any).createdAt}`);
        });
      }
    }

    // Check for specific problematic product
    console.log('\n=== DETAILED ANALYSIS FOR "myproduct" ===');
    const myproductPrices = pricesByProductName.get('myproduct') || [];
    console.log(`"myproduct" has ${myproductPrices.length} prices in Stripe:`);
    myproductPrices.forEach(price => {
      console.log(`  - Price ID: ${price.id}`);
      console.log(`    Type: ${price.type}`);
      console.log(`    Amount: ${price.unit_amount} ${price.currency}`);
    });

    const myproductLevels = await MembershipLevel.find({ key: 'myproduct' });
    console.log(`"myproduct" has ${myproductLevels.length} levels in database:`);
    myproductLevels.forEach(level => {
      console.log(`  - ID: ${level._id}`);
      console.log(`    Price ID: ${level.stripePriceId}`);
      console.log(`    Created: ${(level as any).createdAt}`);
    });

  } catch (error) {
    console.error('Error debugging Stripe sync:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
debugStripeSync(); 