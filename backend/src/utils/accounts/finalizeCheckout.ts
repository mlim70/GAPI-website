import PendingUser from '../../models/pendingUser.model';

/**
 * Lightweight function to mark a pending user as ready from a Stripe checkout session.
 * This is the fallback behavior used by the checkout status endpoint.
 * 
 * The webhook handles the full user/order/subscription creation logic.
 * This function is kept light and idempotent for fallback scenarios.
 */
export async function finalizeCheckoutFromSession(session: any) {
  const sessionId = session.id;
  const pendingUserId = session.metadata?.pendingUserId;

  console.log('🔧 Finalizing checkout from session (light):', { 
    sessionId, 
    pendingUserId
  });

  if (!pendingUserId) {
    console.log('❌ No pendingUserId found in session metadata');
    return;
  }

  // Find pending user by ID
  const pendingUser = await PendingUser.findById(pendingUserId);

  if (!pendingUser) {
    console.log('❌ Pending user not found for finalization');
    return;
  }

  // Update the pending user to mark as ready
  await PendingUser.updateOne(
    { _id: pendingUser._id },
    { 
      $set: { 
        ready: true, 
        finalizedAt: new Date(),
        stripeSessionId: sessionId,
        email: session.customer_details?.email || pendingUser.email,
        name: session.customer_details?.name || pendingUser.name,
        paymentIntentId: session.payment_intent
      } 
    }
  );

  console.log('✅ Pending user marked as ready:', { 
    pendingUserId: pendingUser._id, 
    sessionId 
  });
}
