import { Router } from 'express';
import { stripe } from '../lib/stripe.js';
import MembershipLevel from '../models/membershipLevel.model.js';

const router = Router();

router.post('/', async (req, res) => {
  const { userId, levelKey } = req.body;
  const level = await MembershipLevel.findOne({ key: levelKey });
  if (!level?.stripePriceId) return res.status(404).send('Level not found');

  const session = await stripe.checkout.sessions.create({
    mode: level.isRecurring ? 'subscription' : 'payment',
    line_items: [{ price: level.stripePriceId, quantity: 1 }],
    metadata: { userId, levelKey },
    success_url: `${process.env.DOMAIN || 'http://localhost:5173'}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.DOMAIN || 'http://localhost:5173'}/stripe/cancel`,
    payment_method_types: ['card'], // Only card payments
  });

  res.json({ url: session.url });
});

export default router;
