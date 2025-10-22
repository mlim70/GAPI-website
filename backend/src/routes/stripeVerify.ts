// backend/src/routes/stripeVerify.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { stripe } from '../lib/stripe/client';
import Sponsor from '../models/sponsor.model';
import SponsorCheckoutSession from '../models/sponsorCheckoutSession.model';
import CheckoutSession from '../models/checkoutSession.model';
import User from '../models/user.model';
import { connectToDatabase } from '../utils/database/db';
import { JWT_SECRET } from '../config/env';

import { fixedWindowLimiter, ipId } from '../middleware/limit';
import { addSecurityHeaders } from '../middleware/security';
import { logger } from '../utils/general/logger';

const router = Router();
router.use(addSecurityHeaders);

router.get(
  '/verify-session',
  fixedWindowLimiter({
    windowMs: 5 * 60_000,
    max: 60,
    prefix: 'rl:verify-session',
    idFn: ipId,
    routeKey: () => '/api/stripe/checkout/verify-session',
  }),
  async (req, res) => {
    try {
      await connectToDatabase();

      const sessionId = String(req.query.session_id || '');
      const nonce = String(req.query.nonce || '');

      if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !nonce) {
        return res.status(400).json({ message: 'Missing/invalid session_id or nonce' });
      }

      // First, try to find a subscription checkout session
      const checkoutSession = await CheckoutSession.findOne({ stripeSessionId: sessionId });
      
      if (checkoutSession) {
        // Handle subscription checkout session
        if (checkoutSession.verifyNonce !== nonce) {
          logger.warn('Nonce mismatch for subscription checkout', {
            sessionId,
            createdAt: checkoutSession.createdAt
          });
          return res.status(403).json({ message: 'Nonce mismatch' });
        }

        // Retrieve session from Stripe
        const s = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['payment_intent', 'line_items.data.price.product', 'subscription', 'invoice'],
        });

        // Check if payment is ready (for subscriptions, this means the subscription is active)
        if (!checkoutSession.ready) {
          // Payment not yet confirmed by webhooks - check Stripe's state as fallback
          const subscriptionId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
          
          if (subscriptionId) {
            try {
              // Check Stripe's subscription status directly
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              
              if (['active', 'trialing'].includes(subscription.status)) {
                // Stripe shows subscription is active - self-heal the ready flag
                logger.info('🔧 Self-healing: Stripe subscription is active but local ready=false', {
                  sessionId,
                  subscriptionId,
                  subscriptionStatus: subscription.status,
                  userId: checkoutSession.userId
                });
                
                // Update local state to match Stripe's truth
                checkoutSession.ready = true;
                checkoutSession.readyAt = new Date();
                checkoutSession.status = 'COMPLETED';
                await checkoutSession.save();
                
                logger.info('✅ Self-healed checkout session ready flag');
              } else {
                // Subscription not yet active in Stripe
                return res.json({
                  ready: false,
                  message: 'Payment is still processing. Please wait a moment.'
                });
              }
            } catch (stripeError) {
              logger.warn('⚠️ Failed to check Stripe subscription status:', stripeError);
              return res.json({
                ready: false,
                message: 'Payment is still processing. Please wait a moment.'
              });
            }
          } else {
            // No subscription ID yet - webhooks still processing
            return res.json({
              ready: false,
              message: 'Payment is still processing. Please wait a moment.'
            });
          }
        }

        // Get the user
        const user = await User.findById(checkoutSession.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Generate JWT token
        const tokenPayload = { id: user._id };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        // Clear the nonce to prevent replay attacks
        checkoutSession.verifyNonce = '';
        await checkoutSession.save();

        logger.info('✅ Subscription payment verified successfully:', {
          userId: user._id,
          sessionId: sessionId,
          mode: checkoutSession.mode,
          levelKey: checkoutSession.levelKey
        });

        return res.json({
          ready: true,
          token: token,
          user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            status: user.status,
            membershipLevel: user.membershipLevel,
            stripeCustomerId: user.stripeCustomerId
          },
          message: 'Membership activated successfully!'
        });
      }

      // If not a subscription checkout, try sponsor checkout
      const sponsorSession = await SponsorCheckoutSession.findOne({ stripeSessionId: sessionId });
      
      if (sponsorSession) {
        // Handle sponsor checkout session
        if (sponsorSession.verifyNonce !== nonce) {
          logger.warn('Nonce mismatch for sponsor checkout', {
            sessionId,
            createdAt: sponsorSession.createdAt
          });
          return res.status(403).json({ message: 'Nonce mismatch' });
        }

        // Retrieve session from Stripe and ensure it's paid
        const s = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['payment_intent', 'line_items.data.price.product', 'invoice'],
        });

        if (s.payment_status !== 'paid') {
          return res.status(409).json({ message: `Payment status is ${s.payment_status}` });
        }

        // Debug: Check if invoice was created
        const invoiceId = typeof s.invoice === 'string' ? s.invoice : s.invoice?.id;
        logger.debug('🧾 Invoice creation debug:', {
          sessionId: sessionId,
          invoiceId: invoiceId || 'No invoice created',
          invoiceStatus: typeof s.invoice === 'object' ? s.invoice?.status : 'N/A',
          paymentStatus: s.payment_status,
          invoiceCreationEnabled: s.invoice_creation?.enabled
        });

        // If invoice was created, log additional details
        if (invoiceId) {
          try {
            const invoice = await stripe.invoices.retrieve(invoiceId);
            logger.debug('📧 Invoice details:', {
              invoiceId: invoice.id,
              status: invoice.status,
              customerEmail: invoice.customer_email,
              amountPaid: invoice.amount_paid,
              amountDue: invoice.amount_due,
              invoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf
            });
          } catch (invoiceError) {
            logger.warn('⚠️ Could not retrieve invoice details:', invoiceError);
          }
        } else {
          logger.warn('⚠️ No invoice was created for this session');
        }

        // Get the sponsor record and mark as completed
        const sponsor = await Sponsor.findById(sponsorSession.sponsorId);
        if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });

        // Update sponsor status
        if (sponsor.status !== 'COMPLETED') {
          sponsor.status = 'COMPLETED';
          // Only store the actual PaymentIntent ID if present
          const paymentIntentId = typeof s.payment_intent === 'object' && s.payment_intent?.id;
          if (paymentIntentId) {
            sponsor.stripePaymentIntentId = paymentIntentId;
          }
          await sponsor.save();
        }

        // Update sponsor checkout session status
        if (sponsorSession.status !== 'COMPLETED') {
          sponsorSession.status = 'COMPLETED';
          // Clear the nonce to prevent replay attacks
          sponsorSession.verifyNonce = '';
          await sponsorSession.save();
        }

        logger.info('✅ Sponsor payment verified successfully:', {
          sponsorId: sponsor._id,
          sessionId: sessionId,
          amount: sponsor.amount,
          tierName: sponsor.tierName
        });

        return res.json({
          ok: true,
          sponsorId: sponsor._id.toString(),
          amount: sponsor.amount,
          tierName: sponsor.tierName,
          name: sponsor.name,
          company: sponsor.company,
          message: 'Sponsorship completed successfully!'
        });
      }

      // No session found
      return res.status(404).json({ message: 'Checkout session not found' });

    } catch (err: any) {
      logger.error('verify-session error', { message: err?.message, stack: err?.stack });
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;