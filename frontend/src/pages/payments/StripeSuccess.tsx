// frontend/src/pages/StripeSuccess.tsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager.js';
import { env } from '../../config/environment';

interface StripeSuccessProps {
  setUser: (user: any) => void;
}

export default function StripeSuccess({ setUser }: StripeSuccessProps) {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const sessionId = searchParams.get('session_id');

  // Polling configuration - cap at 90 seconds total
  const MAX_POLLS = 12; // 12 attempts with backoff = ~90 seconds total
  const pollDelayMs = (attempt: number) => Math.min(1500 * attempt, 15000); // simple back-off

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollAttempt = 0;

    async function check() {
      if (pollAttempt >= MAX_POLLS) {
        if (!cancelled) {
          setError('Payment verification is taking longer than expected. This usually means the webhook is delayed or finalization is in progress. Please wait a few minutes and refresh the page, or contact support if the issue persists.');
          setLoading(false);
        }
        return;
      }

      try {
        console.log('🔍 Checking payment status for session:', sessionId);
        console.log('🔍 env.apiUrl value:', env.apiUrl);
        console.log('🔍 env object:', env);
        console.log('🔍 window.location:', {
          origin: window.location.origin,
          protocol: window.location.protocol,
          host: window.location.host,
          href: window.location.href
        });
        
        const res = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}`);
        console.log('📡 Response status:', res.status, res.statusText);
        
        if (!res.ok) {
          console.error('❌ API request failed:', res.status, res.statusText);
          const errorText = await res.text();
          console.error('❌ Error response:', errorText);
          throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('📡 Response data:', data);

        if (!data.ready) {
          // still waiting on webhook
          console.log('⏳ Payment not ready yet, polling attempt:', pollAttempt + 1);
          pollAttempt++;
          if (!cancelled) {
            const delay = pollAttempt === 1 ? 1000 : pollDelayMs(pollAttempt); // First attempt after 1s, then backoff
            console.log('⏳ Next poll in:', delay, 'ms');
            setTimeout(check, delay);
          }
          return;
        }
        // user's ready!
        TokenManager.setToken(data.token);
        TokenManager.setUser(data.user);
        
        // Update the app's user state to trigger re-render
        setUser(data.user);
        console.log('✅ Updated user state in StripeSuccess:', { 
          membershipLevel: data.user?.membershipLevel,
          username: data.user?.username 
        });
        
        setLoading(false);
        setSuccess(true);
      } catch (err) {
        console.error('Error verifying session:', err);
        if (!cancelled) {
          setError('Failed to verify payment - please contact support at info@gapi.org');
          setLoading(false);
        }
      }
    }

    check();

    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing your payment and setting up your account...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
          <p className="mt-2 text-xs text-gray-400">Session ID: {sessionId}</p>
          <p className="mt-2 text-xs text-gray-400">If this takes longer than 90 seconds, please refresh the page</p>
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
              onClick={() => {
                setError('');
                setLoading(true);
                // Restart the verification process
                const check = async () => {
                  try {
                    console.log('🔄 Retry: env.apiUrl value:', env.apiUrl);
                    console.log('🔄 Retry: window.location:', {
                      origin: window.location.origin,
                      protocol: window.location.protocol,
                      host: window.location.host,
                      href: window.location.href
                    });
                    
                    const res = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.ready) {
                        TokenManager.setToken(data.token);
                        TokenManager.setUser(data.user);
                        setUser(data.user);
                        setLoading(false);
                        setSuccess(true);
                      } else {
                        setError('Payment still processing. Please wait a moment and try again.');
                        setLoading(false);
                      }
                    } else {
                      setError('Failed to verify payment. Please try again.');
                      setLoading(false);
                    }
                  } catch (err) {
                    setError('Network error. Please try again.');
                    setLoading(false);
                  }
                };
                check();
              }}
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
          {success 
            ? "Thank you for becoming a GAPI member! Your membership has been activated and you're now logged in."
            : "Thank you for becoming a GAPI member! Your membership has been activated and you'll receive a confirmation email shortly."
          }
        </p>

        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full bg-red hover:bg-red/90 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl active:shadow-md transition-all duration-200 cursor-pointer"
          >
            Go to Home
          </Link>

          <Link
            to="/account"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            View Account
          </Link>
        </div>
      </div>
    </div>
  );
} 
