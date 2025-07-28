// backend/src/utils/updatePricing.ts
import { stripe } from '@lib/stripe.js';
import MembershipLevel from '@models/membershipLevel.model.js';

export async function updateExistingPricing() {
  console.log('🔄 Updating existing membership levels with current Stripe pricing...');
  
  try {
    // Get all membership levels
    const membershipLevels = await MembershipLevel.find({});
    
    for (const level of membershipLevels) {
      try {
        // Fetch current price from Stripe
        const price = await stripe.prices.retrieve(level.stripePriceId);
        
        // Update with current pricing
        const updated = await MembershipLevel.findByIdAndUpdate(
          level._id,
          {
            unitAmount: price.unit_amount || 0,
            currency: price.currency,
            interval: price.recurring?.interval || undefined,
            intervalCount: price.recurring?.interval_count || undefined,
            isRecurring: price.type === 'recurring',
          },
          { new: true }
        );
        
        console.log(`✅ Updated pricing for ${updated.name}: ${updated.unitAmount} ${updated.currency} ${updated.isRecurring ? `per ${updated.interval}` : 'one-time'}`);
        
      } catch (error) {
        console.error(`❌ Error updating pricing for ${level.name} (${level.stripePriceId}):`, error);
      }
    }
    
    console.log('✅ Pricing update complete!');
    
  } catch (error) {
    console.error('❌ Error updating pricing:', error);
  }
}

// Run if called directly
if (require.main === module) {
  import('mongoose').then(async (mongoose) => {
    await mongoose.connect(process.env.MONGODB_URI!);
    await updateExistingPricing();
    await mongoose.disconnect();
  });
} 