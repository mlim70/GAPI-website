import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { env } from '../../config/environment';

interface EmailVerificationProps {
  pendingUserId?: string;
  email?: string;
  name?: string;
}

export default function EmailVerification({ 
  pendingUserId: propPendingUserId, 
  email: propEmail, 
  name: propName 
}: EmailVerificationProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Initialize reCAPTCHA hook for checkout
  const { executeRecaptcha } = useRecaptcha({
    siteKey: RECAPTCHA_CONFIG.SITE_KEY,
    action: RECAPTCHA_CONFIG.ACTIONS.CHECKOUT
  });

  // Get params from URL (for direct link access and props)
  const token = searchParams.get('token');
  const pendingUserId = searchParams.get('pendingUserId') || propPendingUserId;
  const email = searchParams.get('email') || propEmail;
  const name = searchParams.get('name') || propName;

  useEffect(() => {
    // If we have token and pendingUserId in URL, verify immediately
    if (token && pendingUserId) {
      handleVerification(token, pendingUserId);
    }
  }, [token, pendingUserId]);

  const handleVerification = async (verificationToken: string, userId: string) => {
    setVerifying(true);
    setError('');

    try {
      const response = await fetch(`${env.apiUrl}/auth/verify-email?token=${verificationToken}&pendingUserId=${userId}`);
      
      if (response.ok) {
        setSuccess(true);
        // Get the levelKey from the verification response
        const verificationData = await response.json();
        if (verificationData.levelKey) {
          await handleDirectCheckout(userId, verificationData.levelKey);
        } else {
          setError('Failed to load registration details');
        }
      } else {
        const errorData = await response.json();
        
        // Handle specific error codes for better UX
        if (errorData.code === 'LINK_EXPIRED') {
          setError('This verification link has expired. Please request a new one.');
        } else if (errorData.code === 'REGISTRATION_EXPIRED') {
          setError('Your registration has expired. Please register again.');
        } else {
          setError(errorData.message || 'Verification failed');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDirectCheckout = async (pendingUserId: string, levelKey: string) => {
    console.log('🛒 Starting handleDirectCheckout with:', { pendingUserId, levelKey });
    try {
      // Execute reCAPTCHA verification
      console.log('🔍 Executing reCAPTCHA verification for checkout...');
      console.log('🔍 reCAPTCHA site key:', RECAPTCHA_CONFIG.SITE_KEY);
      console.log('🔍 reCAPTCHA action:', RECAPTCHA_CONFIG.ACTIONS.CHECKOUT);
      console.log('🔍 window.grecaptcha available:', !!window.grecaptcha);
      
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
        console.log('✅ reCAPTCHA token obtained for checkout');
      } catch (recaptchaError) {
        console.error('❌ reCAPTCHA execution failed:', recaptchaError);
        throw new Error('Security verification failed. Please refresh the page and try again.');
      }

      // Create Stripe checkout session
      console.log('🔗 Making checkout request to /api/stripe/checkout');
      const checkoutResponse = await fetch(`${env.apiUrl}/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          levelKey,
          pendingUserId,
          recaptchaToken,
        }),
      });

      console.log('📡 Checkout response status:', checkoutResponse.status, checkoutResponse.statusText);
      console.log('📡 Checkout response headers:', Object.fromEntries(checkoutResponse.headers.entries()));

      if (!checkoutResponse.ok) {
        let errorMessage = 'Checkout failed';
        const textContent = await checkoutResponse.text();
        console.error('❌ Checkout response text:', textContent);
        try {
          const errorData = JSON.parse(textContent);
          errorMessage = errorData.message || errorMessage;
          console.error('❌ Parsed error data:', errorData);
        } catch (parseError) {
          console.error('❌ Failed to parse error response as JSON:', parseError);
          errorMessage = `Server error: ${checkoutResponse.status}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await checkoutResponse.json();
      console.log('📡 Checkout response body →', responseData);
      console.log('📡 Response data type:', typeof responseData);
      console.log('📡 Response data keys:', Object.keys(responseData || {}));
      
      // Validate response data
      if (!responseData || typeof responseData !== 'object') {
        console.error('❌ Invalid response format:', responseData);
        throw new Error('Invalid response from server');
      }
      
      // Validate sessionId exists and is a string
      const { sessionId, sessionUrl } = responseData;
      console.log('🔍 Extracted sessionId:', sessionId);
      console.log('🔍 Extracted sessionUrl:', sessionUrl);
      console.log('🔍 sessionId type:', typeof sessionId);
      console.log('🔍 sessionId length:', sessionId?.length);
      
      if (!sessionId || typeof sessionId !== 'string') {
        console.error('❌ Invalid sessionId in response:', responseData);
        throw new Error('Invalid checkout session received from server');
      }
      
      // Use Stripe JS SDK for better reliability
      const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      console.log('🔑 Stripe publishable key exists:', !!stripePublishableKey);
      console.log('🔑 Stripe publishable key prefix:', stripePublishableKey?.substring(0, 7));
      
      if (!stripePublishableKey) {
        throw new Error('Stripe configuration is missing');
      }
      
      console.log('🔄 Loading Stripe...');
      const stripe = await loadStripe(stripePublishableKey);
      console.log('🔄 Stripe loaded successfully:', !!stripe);
      
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
      console.log('🔄 About to call stripe.redirectToCheckout with sessionId:', sessionId);
      const { error } = await stripe.redirectToCheckout({ sessionId });
      console.log('🔄 Stripe redirectToCheckout result:', { error: error?.message || 'No error' });
      
      if (error) {
        console.error('❌ Stripe redirectToCheckout error:', error);
        throw new Error(error.message || 'Checkout failed');
      }
      
      console.log('✅ Stripe redirectToCheckout successful');
    } catch (err: any) {
      console.error('❌ Checkout error:', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      setError(err.message || 'Checkout failed');
      setVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    if (!pendingUserId) {
      setError('No pending user ID available');
      return;
    }

    setResending(true);
    setError('');
    setResendSuccess(false);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pendingUserId }),
      });

      // The backend now returns 204 for all cases to prevent information leakage
      if (response.status === 204) {
        setError('');
        setResendSuccess(true);
      } else {
        setError('Failed to resend email. Please try again later.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToRegistration = () => {
    navigate('/become-a-member');
  };

  // If we're verifying from URL params
  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Verifying your email...</h2>
              <p className="mt-2 text-sm text-gray-600">Please wait while we verify your email address.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If verification was successful
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Email verified successfully!</h2>
              <p className="mt-2 text-sm text-gray-600">Preparing your checkout session...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there's an error with specific codes, show appropriate UI
  if (error && (error.includes('expired') || error.includes('expired'))) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Link Expired</h2>
              <p className="mt-2 text-sm text-gray-600">{error}</p>
              
              <div className="mt-6 space-y-4">
                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? 'Sending...' : 'Request New Verification Link'}
                </button>

                <button
                  onClick={handleBackToRegistration}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main email verification page
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a verification link to{' '}
              <span className="font-medium text-gray-900">{email || 'your email address'}</span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Click the link in your email to verify your account and continue to checkout.
            </p>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L13 10.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">Verification link resent successfully!</p>
                </div>
              </div>
            </div>
          )}


          <div className="mt-6 space-y-4">
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? 'Sending...' : "Didn't receive the email? Resend"}
            </button>

            <button
              onClick={handleBackToRegistration}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to registration
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Need help?</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                If you're having trouble, please contact{' '}
                <a href="mailto:info@gapi.org" className="text-blue-600 hover:text-blue-500">
                  info@gapi.org
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
