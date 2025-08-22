import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { env } from '../../config/environment';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import TokenManager from '../../utils/tokenManager';

interface EmailVerificationProps {
  email?: string;
  name?: string;
}



export default function EmailVerification({ 
  email: propEmail, 
  name: propName 
}: EmailVerificationProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [verificationInFlight, setVerificationInFlight] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [checkoutInFlight, setCheckoutInFlight] = useState(false);

  // reCAPTCHA hook for resend verification
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({
    siteKey: RECAPTCHA_CONFIG.SITE_KEY,
    action: RECAPTCHA_CONFIG.ACTIONS.RESEND_VERIFICATION,
  });

  // Get params from URL (for direct link access and props)
  const token = searchParams.get('token');
  const email = searchParams.get('email') || propEmail;
  const name = searchParams.get('name') || propName;

  useEffect(() => {
    // If we have token in URL, verify immediately
    if (token) {
      handleVerification(token);
    }
  }, [token]);



  // Strip token from URL after verification to prevent re-verification on refresh/back navigation
  useEffect(() => {
    if (verificationResult) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [verificationResult]);

  // Auto-redirect to checkout if user has valid signupIntent (unconditional on intent)
  useEffect(() => {
    if (!checkoutStarted && verificationResult?.next && verificationResult?.nextLevelKey) {
      const redirectTimer = setTimeout(() => {
        console.log('🔄 Auto-redirecting to checkout...');
        handleStartCheckout();
      }, 1200); // 1.2 second delay to show success message
      
      return () => clearTimeout(redirectTimer);
    }
  }, [verificationResult, checkoutStarted]);





  const handleVerification = async (verificationToken: string) => {
    if (verificationInFlight) return;
    setVerificationInFlight(true);
    
    setVerifying(true);
    setError('');

    try {
      const response = await fetch(`${env.apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: verificationToken,
        }),
      });
      
      if (response.ok) {
        // Get the JWT token and user data from the verification response
        const verificationData = await response.json();
        console.log('✅ Email verification successful:', verificationData);
        
        // Store verification result
        setVerificationResult(verificationData);
        
        if (verificationData.alreadyVerified) {
          // User was already verified, show success state
          console.log('✅ User already verified, showing success state');
          return;
        }
        
        if (verificationData?.user) {
          // Store user data temporarily (not logged in yet)
          localStorage.setItem('tempUser', JSON.stringify(verificationData.user));
          console.log('✅ User data stored for checkout');
        } else {
          console.error('❌ Missing user in verification response:', verificationData);
          setError('Failed to complete verification. Please try again.');
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
      setVerificationInFlight(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    setError('');
    setResendSuccess(false);

    try {
      // Check if we have a stored auth token (user is authenticated)
      const authToken = TokenManager.getToken() || localStorage.getItem('token'); // prefer TokenManager
      
      let response;
      
      if (authToken) {
        // AUTHENTICATED CALL: Use JWT token only (no reCAPTCHA needed)
        console.log('🔐 Making authenticated resend verification request');
        response = await fetch(`${env.apiUrl}/auth/resend-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({}), // No body needed for authenticated calls
        });
      } else if (email) {
        // UNAUTHENTICATED CALL: Execute reCAPTCHA verification
        console.log('🔍 Executing reCAPTCHA for unauthenticated resend');
        const recaptchaToken = await executeRecaptcha();
        if (!recaptchaToken) {
          setError('Security verification failed. Please try again.');
          return;
        }

        // UNAUTHENTICATED CALL: Use email only
        console.log('📧 Making unauthenticated resend verification request');
        response = await fetch(`${env.apiUrl}/auth/resend-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email,
            recaptchaToken 
          }),
        });
      } else {
        setError('Unable to resend verification email. Please try again or contact support.');
        return;
      }

      // The backend returns 204 for all cases to prevent information leakage
      if (response.status === 204) {
        setError('');
        setResendSuccess(true);
        // Clear reCAPTCHA token cache after successful request
        clearTokenCache();
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

  const handleStartCheckout = async () => {
    // Guard against double starts and ensure we have required data
    if (checkoutStarted || checkoutInFlight || !verificationResult?.nextLevelKey) return;
    
    setCheckoutStarted(true);
    setCheckoutInFlight(true);
    
    // Create abort controller for cleanup on unmount
    const controller = new AbortController();
    
    try {
      // Get temporary user data for unauthenticated checkout
      const tempUser = localStorage.getItem('tempUser');
      let userData = null;
      
      if (tempUser) {
        userData = JSON.parse(tempUser);
      }
      
      // Generate idempotency key to prevent duplicate Stripe sessions
      const idempotencyKey = `verify:${verificationResult.user?._id || 'anon'}:${verificationResult.checkoutNonce || verificationResult.token || token || ''}`;
      
      // Call the checkout start endpoint with abort signal
      const response = await fetch(`${env.apiUrl}/stripe/checkout/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          levelKey: verificationResult.nextLevelKey,
          email: userData?.email || verificationResult.user?.email,
          firstName: userData?.name?.first || verificationResult.user?.name?.first,
          lastName: userData?.name?.last || verificationResult.user?.name?.last,
          idempotencyKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start checkout');
      }

      const checkoutData = await response.json();
      
      if (checkoutData.reused) {
        console.log('🔄 Reusing existing checkout session');
      }
      
      // Redirect to Stripe checkout
      if (checkoutData.sessionUrl) {
        window.location.href = checkoutData.sessionUrl;
      } else {
        throw new Error('No checkout URL received');
      }
      
    } catch (error: unknown) {
      // Only reset state if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        setCheckoutStarted(false);
        console.error('Failed to start checkout:', error);
        setError(error.message || 'Failed to start checkout');
      }
    } finally {
      setCheckoutInFlight(false);
    }
    
    // Return cleanup function for abort controller
    return () => controller.abort();
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



  // If verification was successful and shows success state
  if (verificationResult && !error) {
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
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                {verificationResult.alreadyVerified ? 'Email Already Verified!' : 'Email Verified Successfully!'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {verificationResult.alreadyVerified 
                  ? 'You can now complete your membership registration.'
                  : 'Redirecting you to complete payment and activate your account.'
                }
              </p>
              
              {verificationResult.next && (
                <div className="mt-6">
                  <div className="text-sm text-gray-500 mb-3">
                    Redirecting to checkout...
                  </div>

                  {checkoutStarted && (
                    <div className="text-sm text-gray-400">
                      Starting checkout...
                    </div>
                  )}
                </div>
              )}
              
              {!verificationResult.next && (
                <div className="mt-6">
                  <div className="text-sm text-gray-500 mb-3">
                    No active membership registration found.
                  </div>
                  <button
                    onClick={handleBackToRegistration}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Start New Registration
                  </button>
                </div>
              )}
              
              {/* Only show Back to Registration if there's no next step */}
              {!verificationResult.next && (
                <div className="mt-4">
                  <button
                    onClick={handleBackToRegistration}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Back to Registration
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

      // If verification was successful
    if (error && error.toLowerCase().includes('expired')) {

    // Show expired link message for users who actually need a new link
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
