// frontend/src/pages/StripeSuccess.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager';
import { env } from '../../config/environment';

interface StripeSuccessProps {
  setUser: (user: any) => void;
}

export default function StripeSuccess({ setUser }: StripeSuccessProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  // Retry verification function
  const retryVerification = async () => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    const nonce = new URLSearchParams(window.location.search).get('nonce');
    
    if (!sessionId || !nonce) {
      setError('Missing session information. Please refresh the page.');
      return;
    }
    
    setRetrying(true);
    setError('');
    
    try {
      console.log('🔄 Retrying verification...');
      const r = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}&nonce=${nonce}`);
      
      if (!r.ok) {
        if (r.status === 403) {
          // Handle nonce mismatch specifically with a soft message
          setError('This link is invalid or expired. Please return to the checkout page and try again.');
          return;
        }
        const text = await r.text().catch(() => '');
        throw new Error(text || 'Verification failed');
      }
      
      const data = await r.json();
      if (data.ready) {
        // Store both token and user data persistently
        TokenManager.setToken(data.token);
        TokenManager.setUser(data.user);
        
        // Update React state
        setUser?.(data.user);
        
        // Show success
        setLoading(false);
        return;
      } else {
        // Still not ready, show appropriate message
        setError('Payment is still processing. Please wait a moment or refresh the page.');
      }
    } catch (e) {
      console.error('Retry verification failed:', e);
      setError('Verification failed. Please try again or refresh the page.');
    } finally {
      setRetrying(false);
    }
  };

  // Polling function for payment status
  const pollPaymentStatus = async () => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) return;

    console.log('🔄 Starting payment status polling...');
    
    // Poll for up to 90 seconds with 2-second backoff
    for (let i = 0; i < 45; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const r = await fetch(`${env.apiUrl}/stripe/checkout/payment-status?sessionId=${sessionId}`);
        if (!r.ok) continue;
        
        const data = await r.json();
        if (data.ready) {
          console.log('✅ Payment confirmed via polling:', data);
          
          // Get user data and token via verify-session (with nonce)
          const nonce = new URLSearchParams(window.location.search).get('nonce');
          if (nonce) {
            const verifyR = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}&nonce=${nonce}`);
            if (verifyR.status === 403) {
              // Handle nonce mismatch specifically with a soft message
              setError('This link is invalid or expired. Please return to the checkout page and try again.');
              setLoading(false);
              return;
            }
            if (verifyR.ok) {
              const verifyData = await verifyR.json();
              if (verifyData.ready) {
                // Store both token and user data persistently
                TokenManager.setToken(verifyData.token);
                TokenManager.setUser(verifyData.user);
                
                // Update React state
                setUser?.(verifyData.user);
                
                // Show success
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch (pollError) {
        console.warn('Polling attempt failed:', pollError);
      }
    }
    
    // Polling timed out
    setError('Payment is still processing. Please try again in a moment.');
    setLoading(false);
  };

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    const nonce = new URLSearchParams(window.location.search).get('nonce');
    
    if (!sessionId) {
      setError('This link is missing payment information. If you already paid, please check your email or go to your Account page.');
      setLoading(false);
      return;
    }
    
    if (!nonce) {
      setError('This link is missing verification information. Please return to the checkout page and try again.');
      setLoading(false);
      return;
    }
    
    (async () => {
      try {
        const r = await fetch(`${env.apiUrl}/stripe/checkout/verify-session?session_id=${sessionId}&nonce=${nonce}`);
        if (!r.ok) {
          if (r.status === 403) {
            // Handle nonce mismatch specifically with a soft message
            setError('This link is invalid or expired. Please return to the checkout page and try again.');
            setLoading(false);
            return;
          }
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
          
          // Show success message - no redirect to account page
          setLoading(false);
        } else {
          // Start polling payment-status for a short window
          console.log('Session not ready yet, starting polling:', data);
          await pollPaymentStatus();
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
      <div className="min-h-screen flex items-center justify-center py-8 page-background">
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
      <div className="min-h-screen flex items-center justify-center py-8 page-background">
        <div className="text-center">
                  <div className={`px-4 py-3 rounded mb-4 ${
          error.includes('invalid or expired') || error.includes('missing')
            ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
            : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          {error}
        </div>
          <div className="space-y-4">
            {!error.includes('invalid or expired') && !error.includes('missing') && (
              <button
                onClick={retryVerification}
                disabled={retrying}
                className={`font-semibold py-2 px-4 rounded transition-colors ${
                  retrying 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {retrying ? 'Verifying...' : 'Retry Verification'}
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              {error.includes('invalid or expired') || error.includes('missing') ? 'Try Again' : 'Refresh Page'}
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
    <div className="min-h-screen flex items-center justify-center py-8 page-background">
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
            to="/home"
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
