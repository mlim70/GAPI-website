// frontend/src/pages/sponsor/SponsorSuccess.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { env } from '../../config/environment';
import { logger } from '../../utils/logger';

export default function SponsorSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifySponsorship = async () => {
      const sessionId = searchParams.get('session_id');
      const nonce = searchParams.get('nonce');

      if (!sessionId || !nonce) {
        setError('Missing verification information. Please contact us if you completed payment.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}&nonce=${nonce}`
        );

        if (response.ok) {
          setSuccess(true);
          logger.info('✅ Sponsorship verified successfully');
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Verification failed' }));
          setError(errorData.message || 'Unable to verify sponsorship. Please contact us.');
        }
      } catch (err) {
        logger.error('❌ Error verifying sponsorship:', err);
        setError('Unable to verify sponsorship. Please contact us if you completed payment.');
      } finally {
        setLoading(false);
      }
    };

    verifySponsorship();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
          <p className="text-neutral-dark">Verifying your sponsorship...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-dark mb-4">Verification Issue</h1>
          <p className="text-neutral-dark/80 mb-6">{error}</p>
          <div className="space-y-3">
            <Link
              to="/contact?subject=Sponsorship Payment Verification"
              className="block w-full bg-red text-white py-3 px-6 rounded-lg font-semibold hover:bg-red/90 transition-colors"
            >
              Contact Support
            </Link>
            <Link
              to="/"
              className="block w-full bg-neutral-light text-neutral-dark py-3 px-6 rounded-lg font-semibold hover:bg-neutral-light/80 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-neutral-dark mb-4">Thank You for Your Sponsorship!</h1>
        <p className="text-neutral-dark/80 mb-6">
          Your sponsorship has been successfully processed. We're grateful for your support of the GAPI medical community.
        </p>
        <p className="text-sm text-neutral-dark/60 mb-6">
          You will receive a confirmation email shortly with your sponsorship details.
        </p>
        <div className="space-y-3">
          <Link
            to="/"
            className="block w-full bg-red text-white py-3 px-6 rounded-lg font-semibold hover:bg-red/90 transition-colors"
          >
            Return Home
          </Link>
          <Link
            to="/sponsor-us"
            className="block w-full bg-neutral-light text-neutral-dark py-3 px-6 rounded-lg font-semibold hover:bg-neutral-light/80 transition-colors"
          >
            View Sponsorship Options
          </Link>
        </div>
      </div>
    </div>
  );
}
