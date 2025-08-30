// backend/src/utils/stripe/cachedRetrieval.ts
import { stripe } from '../../lib/stripe/client';
import { 
  getCachedPrice, 
  cachePrice, 
  getCachedProduct, 
  cacheProduct,
  CachedPrice,
  CachedProduct
} from './cache';
import { logger } from '../general/logger';

/**
 * Retrieve Stripe price data with caching
 * Returns cached data if available, otherwise fetches from Stripe and caches
 */
export async function getCachedStripePrice(priceId: string): Promise<CachedPrice> {
  // Check cache first
  const cached = getCachedPrice(priceId);
  if (cached) {
    logger.debug('✅ Cache HIT - Using cached price data:', { priceId, active: cached.active });
    return cached;
  }

  // Fetch from Stripe if not cached
  logger.debug('❌ Cache MISS - Fetching price from Stripe:', priceId);
  const price = await stripe.prices.retrieve(priceId);
  
  // Cache the essential data
  const priceData: CachedPrice = {
    id: price.id,
    active: price.active,
    currency: price.currency,
    unit_amount: price.unit_amount,
    recurring: price.recurring ? {
      interval: price.recurring.interval,
      interval_count: price.recurring.interval_count
    } : undefined,
    product: typeof price.product === 'string' ? price.product : price.product.id
  };
  
  cachePrice(priceId, priceData);
  logger.debug('Cached new price data:', { priceId, active: priceData.active });
  
  return priceData;
}

/**
 * Retrieve Stripe product data with caching
 * Returns cached data if available, otherwise fetches from Stripe and caches
 */
export async function getCachedStripeProduct(productId: string): Promise<CachedProduct> {
  // Check cache first
  const cached = getCachedProduct(productId);
  if (cached) {
    logger.debug('✅ Cache HIT - Using cached product data:', { productId, active: cached.active });
    return cached;
  }

  // Fetch from Stripe if not cached
  logger.debug('❌ Cache MISS - Fetching product from Stripe:', productId);
  const product = await stripe.products.retrieve(productId);
  
  // Cache the essential data
  const productData: CachedProduct = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description
  };
  
  cacheProduct(productId, productData);
  logger.debug('Cached new product data:', { productId, active: productData.active });
  
  return productData;
}

/**
 * Retrieve both price and product data with caching
 * Optimized to fetch both in parallel when neither is cached
 */
export async function getCachedStripePriceAndProduct(priceId: string): Promise<{
  price: CachedPrice;
  product: CachedProduct;
}> {
  // Check both caches first
  const cachedPrice = getCachedPrice(priceId);
  const cachedProduct = cachedPrice ? getCachedProduct(cachedPrice.product) : undefined;
  
  if (cachedPrice && cachedProduct) {
    logger.debug('✅ Cache HIT - Using cached price and product data:', { 
      priceId, 
      productId: cachedPrice.product,
      priceActive: cachedPrice.active,
      productActive: cachedProduct.active
    });
    return { price: cachedPrice, product: cachedProduct };
  }

  // Fetch what's missing
  if (!cachedPrice) {
    logger.debug('❌ Cache MISS - Fetching price from Stripe:', priceId);
    const price = await stripe.prices.retrieve(priceId);
    
    const priceData: CachedPrice = {
      id: price.id,
      active: price.active,
      currency: price.currency,
      unit_amount: price.unit_amount,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        interval_count: price.recurring.interval_count
      } : undefined,
      product: typeof price.product === 'string' ? price.product : price.product.id
    };
    
    cachePrice(priceId, priceData);
    
    // If we don't have the product cached, fetch it
    if (!cachedProduct) {
      logger.debug('❌ Cache MISS - Fetching product from Stripe:', priceData.product);
      const product = await stripe.products.retrieve(priceData.product);
      const productData: CachedProduct = {
        id: product.id,
        active: product.active,
        name: product.name,
        description: product.description
      };
      
      cacheProduct(priceData.product, productData);
      logger.debug('Cached new price and product data:', { 
        priceId, 
        productId: priceData.product,
        priceActive: priceData.active,
        productActive: productData.active
      });
      
      return { price: priceData, product: productData };
    }
    
    return { price: priceData, product: cachedProduct! };
  } else {
    // We have price but not product
    logger.debug('❌ Cache MISS - Fetching product from Stripe:', cachedPrice.product);
    const product = await stripe.products.retrieve(cachedPrice.product);
    const productData: CachedProduct = {
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description
    };
    
    cacheProduct(cachedPrice.product, productData);
    logger.debug('Cached new product data:', { 
      productId: cachedPrice.product,
      productActive: productData.active
    });
    
    return { price: cachedPrice, product: productData };
  }
}
