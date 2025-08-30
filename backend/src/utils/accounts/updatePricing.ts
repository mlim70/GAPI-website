// backend/src/utils/accounts/updatePricing.ts
import mongoose from 'mongoose';
import { logger } from '../general/logger';
import { connectToDatabase } from '../database/db';
import MembershipLevel from '../../models/membershipLevel.model';
import { stripe } from '../../lib/stripe/client';
import { getCachedStripePriceAndProduct } from '../stripe/cachedRetrieval';

export async function updatePricing() {
  try {
    logger.info('🔄 Updating existing membership levels with current Stripe pricing...');
    
    const levels = await MembershipLevel.find({});
    
    for (const level of levels) {
      if (!level.stripePriceId) {
        logger.warn(`⚠️ Skipping level ${level.key} - no Stripe price ID`);
        continue;
      }
      
      try {
        const { price, product } = await getCachedStripePriceAndProduct(level.stripePriceId);
        
        if (!price.active) {
          logger.warn(`⚠️ Skipping inactive price for ${level.key}: ${level.stripePriceId}`);
          continue;
        }
        
        if (!product.active) {
          logger.warn(`⚠️ Skipping inactive product for ${level.key}: ${product.id}`);
          continue;
        }
        
        const unitAmount = price.unit_amount || 0;
        const currency = price.currency;
        const interval = price.recurring?.interval;
        const intervalCount = price.recurring?.interval_count;
        const isRecurring = !!price.recurring;
        
        const updated = await MembershipLevel.findByIdAndUpdate(
          level._id,
          {
            unitAmount,
            currency,
            interval,
            intervalCount,
            isRecurring
          },
          { new: true }
        );
        
        if (updated) {
          logger.info(`✅ Updated pricing for ${updated.key}: ${updated.unitAmount} ${updated.currency} ${updated.isRecurring ? `per ${updated.interval}` : 'one-time'}`);
        }
      } catch (error) {
        logger.error(`❌ Error updating pricing for ${level.key} (${level.stripePriceId}):`, error);
      }
    }
    
    logger.info('✅ Pricing update complete!');
  } catch (error) {
    logger.error('❌ Error updating pricing:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  import('mongoose').then(async (mongoose) => {
    await connectToDatabase();
    await updatePricing();
    await mongoose.disconnect();
  });
} 