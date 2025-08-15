// frontend/src/pages/StripeSuccess.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager.js';
import { env } from '../../config/environment';

interface StripeSuccessProps {
  setUser: (user: any) => void;
}

export default function StripeSuccess({ setUser }: StripeSuccessProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) {
      setError('Missing payment session. If you already paid, please check your email or go to your Account page.');
      setLoading(false);
      return;
    }
    
    (async () => {
      try {
        const r = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}`);
        if (!r.ok) {
          const text = await r.text().catch(()=>'');
          throw new Error(text || 'Verification failed');
        }
        const data = await r.json();
        if (data.ready) {
          // Store both token and user data persistently
          TokenManager.setToken(data.token);
          TokenManager.setUser(data.user);
          
          // Update React state
          setUser?.(data.user);
          
          // Show success message briefly, then redirect
          setTimeout(() => {
            window.location.replace('/auth/account');
          }, 500);
        } else {
          // optional: fallback polling /status if you want
          console.log('Session not ready yet:', data);
          setError('Payment is still processing. Please wait a moment and refresh the page.');
          setLoading(false);
        }
      } catch (e) {
        console.error('verify-session failed', e);
        setError('Failed to verify payment. Please contact support.');
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing your payment and setting up your account...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 bg-gray-50">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Retry Verification
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Refresh Page
            </button>
            <div>
              <Link
                to="/become-a-member"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Return to membership page
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>

        <p className="text-gray-600 mb-6">
          Thank you for becoming a GAPI member! Your membership has been activated and you'll receive a confirmation email shortly.
        </p>

        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full bg-red hover:bg-red/90 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl active:shadow-md transition-all duration-200 cursor-pointer"
          >
            Go to Home
          </Link>

          <Link
            to="/auth/account"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            View Account
          </Link>
        </div>
      </div>
    </div>
  );
} 
