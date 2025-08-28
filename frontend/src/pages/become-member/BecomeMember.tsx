// frontend/src/pages/become-member/BecomeMember.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembershipLevels } from '../../hooks/useMembershipLevels';
import { useAccountData } from '../../hooks/useAccountData';
import { loadStripe } from '@stripe/stripe-js';
import RegistrationForm from '../../components/auth/RegistrationForm';
import TokenManager from '../../utils/tokenManager';
import { formatPrice } from '../../utils/formatters';
import { RegistrationFormData } from '../../types/index';
import { validateAccountStatus } from '../../utils/accountValidation';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { env } from '../../config/environment';
import { logger } from '../../utils/logger';


interface User {
  _id: string;
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  membershipLevel?: string;
}

interface BecomeMemberProps {
  user?: User | null;
  setUser?: (user: any) => void;
}



export default function BecomeMember({ user, setUser }: BecomeMemberProps) {
  const { levels, loading, error: levelsError } = useMembershipLevels();
  const { accountData, error: accountError } = useAccountData();
  const [processingLevel, setProcessingLevel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  // reCAPTCHA hook for registration
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({ 
    siteKey: RECAPTCHA_CONFIG.SITE_KEY, 
    action: RECAPTCHA_CONFIG.ACTIONS.REGISTRATION 
  });
  

  
  // Clear processing state when user changes (e.g., after returning from Stripe)
  useEffect(() => {
    if (user && processingLevel) {
      setProcessingLevel(null);
    }
  }, [user, processingLevel]);

  // Check if user has lifetime membership (ONE_TIME subscription)
  const hasLifetime = accountData?.subscription?.kind === 'ONE_TIME';

  // Check if a level is the user's current plan
  const isCurrentLevel = (level: any) => {
    return accountData?.subscription?.membershipLevel?.key === level?.key;
  };

  // Combine errors from hook and local state, but don't show account errors for non-logged-in users
  const displayError = levelsError || (user ? accountError : null) || error;



  // Validate account status for existing users when component mounts
  useEffect(() => {
    if (user) {
      validateAccountStatus().then(validation => {
        if (!validation.isValid && validation.shouldRedirect && validation.redirectUrl) {
          // Clear invalid user data
          if (setUser) {
            setUser(null);
          }
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          
          // Redirect to appropriate page
          window.location.href = validation.redirectUrl;
        }
      }).catch(error => {
        logger.error('Error validating account on mount:', error);
      });
    }
  }, [user, setUser]);



  const handleCheckout = async (levelKey: string, formData: RegistrationFormData) => {
    setProcessingLevel(levelKey);
    setError('');
    
    try {
      // Execute reCAPTCHA verification
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        logger.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      // RegistrationForm component handles validation and passes the form data to this function

      // Create pending user data as JSON
      const registrationData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        levelKey: levelKey,
        recaptchaToken: recaptchaToken,
      };

      // Test API connectivity first
      try {
        const apiResponse = await fetch(`${env.apiUrl}/membership-levels`);
        if (!apiResponse.ok) {
          throw new Error(`API connectivity check failed: ${apiResponse.status}`);
        }
      } catch (apiError) {
        logger.error('❌ API connectivity check failed:', apiError);
        throw new Error('Unable to connect to the server. Please try again later.');
      }

      const registrationResponse = await fetch(`${env.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });

      if (!registrationResponse.ok) {
        let errorMessage = 'Failed to create user account';
        const textContent = await registrationResponse.text();
        try {
          const errorData = JSON.parse(textContent);
          errorMessage = errorData.message || errorMessage;
          logger.error('❌ Registration error details:', errorData);
        } catch (parseError) {
          // If response is not JSON, use the text content as is
          logger.error('❌ Non-JSON response from register endpoint:', textContent);
          errorMessage = `Server error: ${registrationResponse.status} ${registrationResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await registrationResponse.json();
      const { userId, message, recaptcha } = responseData;
      
      // Log reCAPTCHA score information to browser console
      if (recaptcha) {
        logger.info(`🔒 reCAPTCHA Verification Results:`, {
          score: recaptcha.score,
          action: recaptcha.action,
          success: recaptcha.success,
          threshold: RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION,
          passed: recaptcha.score >= RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION
        });
        
        // Color-coded console output for better visibility
        if (recaptcha.score >= RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION) {
          logger.info(`✅ reCAPTCHA PASSED - Score: ${recaptcha.score} >= ${RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION}`);
        } else {
          logger.info(`❌ reCAPTCHA FAILED - Score: ${recaptcha.score} < ${RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION}`);
        }
      }

      // Redirect to email verification page
      window.location.href = `/email-verification?email=${encodeURIComponent(formData.email)}`;
    } catch (err: any) {
      logger.error('❌ Error in handleCheckout:', err);
      logger.error('❌ Error stack:', err.stack);
      logger.error('❌ Error name:', err.name);
      
      // Provide more specific error messages
      let userFriendlyError = 'Registration failed. Please try again.';
      
      if (err.message.includes('reCAPTCHA')) {
        userFriendlyError = 'Security verification failed. Please refresh the page and try again.';
      } else if (err.message.includes('Security verification failed')) {
        userFriendlyError = 'Security verification failed. Please try again or contact support if the problem persists.';
      } else if (err.message.includes('connect') || err.message.includes('server')) {
        userFriendlyError = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (err.message) {
        userFriendlyError = err.message;
      }
      
      setError(userFriendlyError);
      // Don't re-throw - let the parent handle all error display
    } finally {
      setProcessingLevel(null);
    }
  };

  const handlePlanChange = async (levelKey: string) => {
    try {
      const level = levels.find(l => l.key === levelKey);
      if (!level) throw new Error('Plan not found');

      // Logged-in users:
      if (!user) throw new Error('Please log in to continue');

      const token = TokenManager.getToken();
      if (!token) throw new Error('Authentication required');

      if (level.isRecurring) {
        // 🔁 Subscription -> Subscription: open Billing Portal
        const r = await fetch(`${env.apiUrl}/billing/portal-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Failed to open billing portal');
        const { url } = await r.json();
        window.location.href = url;
        return;
      }

      // 🧾 Subscription -> One-time: use Checkout (server will allow only one-time)
      const checkoutResponse = await fetch(`${env.apiUrl}/stripe/checkout/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ levelKey }), // remove userId; server infers from JWT
      });
      if (!checkoutResponse.ok) {
        const txt = await checkoutResponse.text();
        try {
          const e = JSON.parse(txt);
          throw new Error(e.message || 'Checkout failed');
        } catch { throw new Error(txt || 'Checkout failed'); }
      }

      const { sessionUrl, sessionId } = await checkoutResponse.json();
      
      // Use sessionUrl if available, otherwise fall back to redirectToCheckout
      if (sessionUrl) {
        window.location.href = sessionUrl;
      } else {
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);
        if (!stripe) throw new Error('Failed to load Stripe');
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) throw new Error(error.message || 'Checkout failed');
      }
    } catch (err: any) {
              logger.error('❌ Error in handlePlanChange:', err);
      setError(err.message || 'Plan change failed');
    }
  };

  const handleLevelSelect = async (levelKey: string) => {
    // For existing users, validate account before allowing plan selection
    if (user) {
      try {
        const accountValidation = await validateAccountStatus();
        if (!accountValidation.isValid) {
          if (accountValidation.shouldRedirect && accountValidation.redirectUrl) {
            // Clear invalid user data
            if (setUser) {
              setUser(null);
            }
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            
            // Redirect to appropriate page
            window.location.href = accountValidation.redirectUrl;
            return;
          }
          setError(accountValidation.error || 'Account validation failed');
          return;
        }
        
        // For authenticated users, this function is a no-op
        // They should use handlePlanChange instead
        return;
      } catch (error) {
        logger.error('Error validating account:', error);
        setError('Failed to validate account. Please try again.');
        return;
      }
    }
    
    // Only unauthenticated users can proceed to registration
    setSelectedLevel(levelKey);
    setShowRegistration(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen page-background flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"
            aria-busy="true"
            aria-label="Loading membership options"
          ></div>
          <p className="text-xl font-semibold text-gray-900 mb-2">
            Loading Membership Options...
          </p>
          <p className="text-gray-600">
            Please wait while we prepare your membership information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 page-background">
      <div className="max-w-6xl mx-auto">
        {/* Header section - only show when not in registration form */}
        {!showRegistration && (
          <div className="text-center mb-12">
            <h1 
              className="pt-4 text-4xl md:text-5xl font-bold text-neutral-dark mb-4"
              role="heading"
            >
              {user ? (
                <>
                  Welcome{' '}
                  <span className="text-red">
                    {user.username}
                  </span>
                  !
                </>
              ) : (
                'Become a GAPI Member'
              )}
            </h1>
            <p className="text-xl md:text-2xl text-neutral-dark/50 max-w-2xl mx-auto font-small mb-4">
              Join our community and unlock exclusive benefits, resources, and networking opportunities.
            </p>
          </div>
        )}

        {displayError && !showRegistration && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 flex items-center justify-center text-red-700 bg-red-100 rounded-full">!</span>
              <div>
                <p className="font-medium text-red-800">
                  {displayError}
                </p>
              </div>
            </div>
          </div>
        )}



        {!showRegistration ? (
          <>
            {/* Lifetime membership notice */}
            {hasLifetime && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                <div className="flex items-center">
                  <span className="w-5 h-5 mr-3 flex items-center justify-center text-green-700 bg-green-100 rounded-full">✓</span>
                  <div>
                    <p className="font-medium text-green-800">
                      You have a <strong>lifetime membership</strong>. No subscription is required.
                    </p>
                    <p className="text-green-700 mt-1">
                      Your membership is active and will not expire.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Membership Level Selection */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level) => (
              <div
                key={level._id}
                className="bg-white rounded-lg shadow-sm border border-neutral-light hover:shadow-md transition-shadow duration-200 flex flex-col h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  {/* Header with name */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-neutral-dark capitalize">{level.key.replace(/_/g, ' ')}</h3>
                  </div>
                  
                  {/* Price display */}
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-red">
                      {formatPrice(level.unitAmount, level.currency, level.interval, level.intervalCount)}
                    </div>
                    <div className="text-sm text-neutral-dark/70 mt-1">
                      {level.isRecurring ? 'Recurring payment' : 'One-time payment'}
                    </div>
                  </div>
                  
                  {/* Description */}
                  {level.description && (
                    <p className="text-gray-600 mb-6 flex-grow">{level.description}</p>
                  )}
                  
                  {/* Action button */}
                  <div className="mt-auto">
                    <button
                      onClick={() => user ? handlePlanChange(level.key) : handleLevelSelect(level.key)}
                      disabled={
                        processingLevel === level.key ||
                        isCurrentLevel(level) ||
                        (hasLifetime && !isCurrentLevel(level))
                      }
                      className={`w-full font-medium py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center ${
                        isCurrentLevel(level)
                          ? 'bg-emerald-50 border-2 border-emerald-200 text-green-800 cursor-not-allowed'
                          : (hasLifetime && !isCurrentLevel(level))
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-label={
                        isCurrentLevel(level)
                          ? `Current plan ${level.key}`
                          : user
                            ? `Switch to ${level.key} plan`
                            : `Select ${level.key} membership`
                      }
                    >
                      {processingLevel === level.key ? (
                        <>
                          <div 
                            className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                            aria-busy="true"
                            aria-label="Processing selection"
                          ></div>
                          {user ? 'Switching...' : 'Processing...'}
                        </>
                      ) : (
                        isCurrentLevel(level)
                          ? 'Current Plan'
                          : user ? (
                              hasLifetime
                                ? 'Not Available'
                                : level.isRecurring
                                  ? 'Manage Subscription'
                                  : `Switch to ${level.key.replace(/_/g, ' ')}`
                            ) : (
                              `Select ${level.key.replace(/_/g, ' ')}`
                            )
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        ) : (
           // Registration Form
           <RegistrationForm
             selectedLevel={selectedLevel}
             processingLevel={processingLevel}
             onCheckout={handleCheckout}
             onBack={() => {
               setShowRegistration(false);
               setSelectedLevel(null);
               setError('');
             }}
             error={displayError}
           />
         )}

          {/* How It Works Section - Only show for non-logged-in users */}
          {!showRegistration && (
            <div className="mt-16 max-w-4xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {/* Clickable Header */}
                <button
                  onClick={() => setShowHowItWorks(!showHowItWorks)}
                  className="w-full px-8 py-4 text-left hover:bg-gray-50 transition-all duration-300 flex items-center justify-between group"
                >
                   <div className="flex items-center gap-5">
                     <span className="text-2xl font-semibold text-gray-900">How it works</span>
                   </div>
                   <div className="w-12 h-12 flex items-center justify-center">
                     <div className={`w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-gray-400 group-hover:border-t-gray-600 transition-all duration-300 transform origin-center ${
                       showHowItWorks ? 'rotate-180' : 'rotate-0'
                     }`}></div>
                   </div>
                </button>

                                 {/* Dropdown Content */}
                 <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                   showHowItWorks ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                 }`}>
                   <div className="px-8 pb-8 border-t border-gray-100 bg-gray-50/50">
                     <div className="pt-6 space-y-6">
                       <div className="flex items-start gap-4">
                         <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-1">1</span>
                         <div>
                           <h4 className="font-medium text-gray-900 mb-1">Fill out the registration form</h4>
                           <p className="text-gray-600 text-base leading-relaxed">Select your preferred membership plan and complete the form with your information</p>
                         </div>
                       </div>
                       <div className="flex items-start gap-4">
                         <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-1">2</span>
                         <div>
                           <h4 className="font-medium text-gray-900 mb-1">Verify your email address</h4>
                           <p className="text-gray-600 text-base leading-relaxed">Check your inbox and click the verification link we send you to confirm your account</p>
                         </div>
                       </div>
                       <div className="flex items-start gap-4">
                         <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-1">3</span>
                         <div>
                           <h4 className="font-medium text-gray-900 mb-1">Complete payment</h4>
                           <p className="text-gray-600 text-base leading-relaxed">Secure payment processing to become a GAPI member!</p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}
       </div>
     </div>
   );
 } 
