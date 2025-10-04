// backend/src/routes/stripeVerify.ts
import { Router } from 'express';
import { stripe } from '../lib/stripe/client';
import Sponsor from '../models/sponsor.model';
import SponsorCheckoutSession from '../models/sponsorCheckoutSession.model';
import { connectToDatabase } from '../utils/database/db';
import { addSecurityHeaders } from '../middleware/security';
import { fixedWindowLimiter, ipId } from '../middleware/limit';
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

      // 1) Load our sponsor checkout session record and validate nonce
      const sponsorSession = await SponsorCheckoutSession.findOne({ stripeSessionId: sessionId });
      if (!sponsorSession) return res.status(404).json({ message: 'Sponsor checkout session not found' });
      
      if (sponsorSession.verifyNonce !== nonce) {
        logger.warn('Nonce mismatch', {
          sessionId,
          createdAt: sponsorSession.createdAt
        });
        return res.status(403).json({ message: 'Nonce mismatch' });
      }

      // 2) Retrieve session from Stripe and ensure it's paid
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

      // 3) Get the sponsor record and mark as completed
      const sponsor = await Sponsor.findById(sponsorSession.sponsorId);
      if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });

      // Update sponsor status
      if (sponsor.status !== 'COMPLETED') {
        sponsor.status = 'COMPLETED';
        sponsor.stripePaymentIntentId = (typeof s.payment_intent === 'object' && s.payment_intent?.id) || s.id;
        await sponsor.save();
      }

      // Update sponsor checkout session status
      if (sponsorSession.status !== 'COMPLETED') {
        sponsorSession.status = 'COMPLETED';
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
    } catch (err: any) {
      logger.error('verify-session error', { message: err?.message, stack: err?.stack });
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
