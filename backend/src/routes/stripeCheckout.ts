// backend/src/routes/stripeCheckout.ts
import { Router } from 'express';
import { stripe } from '../lib/stripe/client';
import Sponsor from '../models/sponsor.model';
import SponsorCheckoutSession from '../models/sponsorCheckoutSession.model';
import { connectToDatabase } from '../utils/database/db';
import { getFrontendUrl } from '../config/urls';

import { fixedWindowLimiter, ipId } from '../middleware/limit';
import { addSecurityHeaders, generateVerifyNonce } from '../middleware/security';
import { logger } from '../utils/general/logger';
import { normalizeEmail } from '../utils/email/emailUtils';

const router = Router();
router.use(addSecurityHeaders);

/**
 * POST /sponsor
 * Creates a Stripe checkout session for sponsor payment
 * Completely independent from user accounts
 */
router.post('/sponsor',
  fixedWindowLimiter({
    windowMs: 5 * 60_000,
    max: 10,
    prefix: 'rl:sponsor-checkout',
    idFn: ipId,
    routeKey: () => '/api/sponsor/checkout/sponsor',
  }),
  async (req, res) => {
    try {
      await connectToDatabase();
      logger.info('🚀 Starting sponsor checkout process...');

      const { amount, email, name, company, phone, message, tierName } = req.body;

      // Validate required fields
      if (!amount || !email || !name) {
        return res.status(400).json({ 
          message: 'Missing required fields: amount, email, name' 
        });
      }

      // Validate amount
      const amountInCents = Math.round(parseFloat(amount) * 100);
      if (amountInCents < 100) { // Minimum $1.00
        return res.status(400).json({ 
          message: 'Amount must be at least $1.00' 
        });
      }

      const normalizedEmail = normalizeEmail(email);

      // Create sponsor record (independent of users)
      const sponsor = new Sponsor({
        name: name.trim(),
        email: normalizedEmail,
        company: company?.trim(),
        phone: phone?.trim(),
        message: message?.trim(),
        tierName: tierName?.trim(),
        amount: amountInCents,
        status: 'PENDING'
      });
      await sponsor.save();

      logger.info('✅ Created sponsor record:', { 
        sponsorId: sponsor._id, 
        email: normalizedEmail,
        amount: amountInCents 
      });

      // Create or get Stripe customer (independent customer, not linked to users)
      let stripeCustomer;
      try {
        // Search for existing customer by email
        const existingCustomers = await stripe.customers.list({
          email: normalizedEmail,
          limit: 1
        });

        if (existingCustomers.data.length > 0) {
          stripeCustomer = existingCustomers.data[0];
          logger.info('📋 Using existing Stripe customer:', stripeCustomer.id);
        } else {
          // Create new customer
          stripeCustomer = await stripe.customers.create({
            email: normalizedEmail,
            name: name,
            metadata: {
              type: 'sponsor',
              sponsorId: sponsor._id.toString()
            }
          });
          logger.info('✅ Created new Stripe customer:', stripeCustomer.id);
        }
      } catch (stripeError: any) {
        logger.error('❌ Stripe customer error:', stripeError);
        return res.status(500).json({ message: 'Failed to create Stripe customer' });
      }

      // Update sponsor with Stripe customer ID
      sponsor.stripeCustomerId = stripeCustomer.id;
      await sponsor.save();

      // Generate nonce for verification
      const verifyNonce = generateVerifyNonce();
      
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: stripeCustomer.id,
        // ⬇️ NEW: have Stripe create a paid invoice after successful charge
        invoice_creation: {
          enabled: true,
          // optional: add metadata that will land on the generated invoice
          invoice_data: {
            metadata: {
              sponsorId: sponsor._id.toString(),
              tierName: tierName || 'Custom',
            },
            // Set proper business contact information
            footer: 'Thank you for supporting the GAPI medical community!',
            // You can also set custom fields if needed
            custom_fields: [
              {
                name: 'Organization',
                value: 'Georgia Association of Physicians of Indian Heritage (GAPI)'
              }
            ]
          },
        },
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `GAPI Sponsorship${tierName ? ` - ${tierName}` : ''}`,
              description: `Thank you for supporting the GAPI medical community!`,
              metadata: {
                type: 'sponsorship',
                tierName: tierName || 'Custom'
              }
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }],
        metadata: {
          sponsorId: sponsor._id.toString(),
          customerName: name,
          ...(company && { company }),
          ...(phone && { phone }),
          ...(message && { message }),
          ...(tierName && { tierName }),
          sponsorAmount: amountInCents.toString()
        },
        billing_address_collection: 'auto',
        allow_promotion_codes: false,
        success_url: `${getFrontendUrl()}/sponsor/success?session_id={CHECKOUT_SESSION_ID}&nonce=${verifyNonce}`,
        cancel_url: `${getFrontendUrl()}/sponsor/cancel`,
      });
      
      // Update sponsor with session ID
      sponsor.stripeSessionId = session.id;
      await sponsor.save();

      // Create sponsor checkout session record
      await SponsorCheckoutSession.create({
        sponsorId: sponsor._id,
        stripeSessionId: session.id,
        verifyNonce: verifyNonce,
        status: 'CREATED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      logger.info('✅ Sponsor checkout session created:', {
        sessionId: session.id,
        amount: amountInCents,
        sponsorId: sponsor._id,
        invoiceCreationEnabled: true
      });

      // Debug: Log invoice creation details
      logger.debug('🧾 Invoice creation configured:', {
        sessionId: session.id,
        invoiceCreationEnabled: session.invoice_creation?.enabled,
        invoiceMetadata: session.invoice_creation?.invoice_data?.metadata
      });

      logger.info('🎉 Sponsor checkout session creation successful');
      return res.status(200).json({
        sessionUrl: session.url,
        sessionId: session.id,
        verifyNonce: verifyNonce,
      });
      
    } catch (err: any) {
      logger.error('❌ Unhandled error in sponsor checkout route', {
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
      });
      return res.status(500).json({ 
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
);

export default router;