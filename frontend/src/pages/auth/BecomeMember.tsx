// frontend/src/pages/BecomeMember.tsx
import { useState, useEffect } from 'react';
import { useMembershipLevels } from '../../hooks/useMembershipLevels.js';
import { useAccountData } from '../../hooks/useAccountData.js';
import { loadStripe } from '@stripe/stripe-js';
import RegistrationForm from '../../components/auth/RegistrationForm.js';
import CurrentPlanIndicator from '../../components/auth/CurrentPlanIndicator.js';
import ErrorDisplay from '../../components/common/ErrorDisplay.js';
import TokenManager from '../../utils/tokenManager.js';
import { formatPrice } from '../../utils/formatters.js';
import { RegistrationFormData } from '../../types/index.js';
import { validateAccountStatus, withAccountValidation } from '../../utils/accountValidation.js';
import { useRecaptcha } from '../../hooks/useRecaptcha.js';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha.js';
import { env } from '../../config/environment';


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
  
  // Debug: Log user state changes
  useEffect(() => {
    console.log('🔄 BecomeMember received user update:', { 
      membershipLevel: user?.membershipLevel,
      username: user?.username 
    });
  }, [user]);
  
  // Clear processing state when user changes (e.g., after returning from Stripe)
  useEffect(() => {
    if (user && processingLevel) {
      console.log('🔄 Clearing processing state due to user update');
      setProcessingLevel(null);
    }
  }, [user, processingLevel]);

  // Get current membership level from account data, fallback to user data
  const getCurrentMembershipLevel = () => {
    return accountData?.subscription?.membershipLevel?.key || user?.membershipLevel;
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
        console.error('Error validating account on mount:', error);
      });
    }
  }, [user, setUser]);



  const handleCheckout = async (levelKey: string, formData: RegistrationFormData) => {
    setProcessingLevel(levelKey);
    setError('');
    
    try {
      // Execute reCAPTCHA verification
      console.log('🔍 Executing reCAPTCHA verification...');
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
        console.log('✅ reCAPTCHA token obtained');
      } catch (recaptchaError) {
        console.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      // RegistrationForm component handles validation and passes the form data to this function

      // Create pending user data as JSON
      const pendingUserData = {
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
        console.log('🔍 Testing API connectivity...');
        const healthResponse = await fetch(`${env.apiUrl}/health`);
        console.log('🔍 Health check status:', healthResponse.status);
        if (!healthResponse.ok) {
          throw new Error(`API health check failed: ${healthResponse.status}`);
        }
      } catch (healthError) {
        console.error('❌ API health check failed:', healthError);
        throw new Error('Unable to connect to the server. Please try again later.');
      }

      console.log('🔗 Making pending user request to:', `${env.apiUrl}/auth/pending-user`);
      const pendingUserResponse = await fetch(`${env.apiUrl}/auth/pending-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingUserData),
      });

      console.log('📡 Pending user response status:', pendingUserResponse.status, pendingUserResponse.statusText);

      if (!pendingUserResponse.ok) {
        let errorMessage = 'Failed to create user account';
        const textContent = await pendingUserResponse.text();
        try {
          const errorData = JSON.parse(textContent);
          errorMessage = errorData.message || errorMessage;
          console.error('❌ Pending user creation error details:', errorData);
        } catch (parseError) {
          // If response is not JSON, use the text content as is
          console.error('❌ Non-JSON response from pending-user endpoint:', textContent);
          errorMessage = `Server error: ${pendingUserResponse.status} ${pendingUserResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await pendingUserResponse.json();
      const { pendingUserId, isUpdate, recaptcha } = responseData;
      
      if (isUpdate) {
        console.log('🔄 Resuming existing registration');
      } else {
        console.log('🆕 Starting new registration');
      }
      
      // Log reCAPTCHA score information to browser console
      if (recaptcha) {
        console.log('🔒 reCAPTCHA Verification Results:', {
          score: recaptcha.score,
          action: recaptcha.action,
          success: recaptcha.success,
          threshold: RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION,
          passed: recaptcha.score >= RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION
        });
        
        // Color-coded console output for better visibility
        if (recaptcha.score >= RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION) {
          console.log('%c✅ reCAPTCHA PASSED - Score:', 'color: green; font-weight: bold; font-size: 14px;', 
            recaptcha.score, '>=', RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION);
        } else {
          console.log('%c❌ reCAPTCHA FAILED - Score:', 'color: red; font-weight: bold; font-size: 14px;', 
            recaptcha.score, '<', RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION);
        }
      }

      // Redirect to email verification page instead of directly to checkout
      console.log('📧 Redirecting to email verification page');
      window.location.href = `/email-verification?pendingUserId=${pendingUserId}`;
    } catch (err: any) {
      console.error('❌ Error in handleCheckout:', err);
      console.error('❌ Error stack:', err.stack);
      console.error('❌ Error name:', err.name);
      
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
      const checkoutResponse = await fetch(`${env.apiUrl}/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ levelKey, userId: user._id }),
      });
      if (!checkoutResponse.ok) {
        const txt = await checkoutResponse.text();
        try {
          const e = JSON.parse(txt);
          throw new Error(e.message || 'Checkout failed');
        } catch { throw new Error(txt || 'Checkout failed'); }
      }

      const { sessionId } = await checkoutResponse.json();
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error('Failed to load Stripe');
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw new Error(error.message || 'Checkout failed');
    } catch (err: any) {
      console.error('❌ Error in handlePlanChange:', err);
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
      } catch (error) {
        console.error('Error validating account:', error);
        setError('Failed to validate account. Please try again.');
        return;
      }
    }
    
    setSelectedLevel(levelKey);
    setShowRegistration(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header section - only show when not in registration form */}
        {!showRegistration && (
          <div className="text-center mb-12">
            <h1 
              className="text-4xl font-bold text-neutral-dark mb-4"
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
            <p className="text-xl text-neutral-dark/80 max-w-2xl mx-auto">
              Join our community and unlock exclusive benefits, resources, and networking opportunities.
            </p>
            

            
            {/* Current Plan Indicator for logged-in users */}
            {user && (
              <div className="mt-6 flex justify-center">
                <CurrentPlanIndicator user={user} accountData={accountData} />
              </div>
            )}
          </div>
        )}

        {displayError && !showRegistration && (
          <ErrorDisplay 
            error={displayError}
            className="mb-6"
          />
        )}



        {!showRegistration ? (
          // Membership Level Selection
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level) => (
              <div
                key={level._id}
                className="bg-white rounded-lg shadow-sm border border-neutral-light hover:shadow-md transition-shadow duration-200 flex flex-col h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  {/* Header with name and badge */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-neutral-dark capitalize">{level.key.replace(/_/g, ' ')}</h3>
                    {user && getCurrentMembershipLevel() === level.key && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red/10 text-red-700 border border-red/200">
                        Current Plan
                      </span>
                    )}
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
                    {user && getCurrentMembershipLevel() === level.key ? (
                      // Current Plan Display
                                             <div className="w-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-medium py-3 px-4 rounded-md flex items-center justify-center">
                         <span className="w-5 h-5 mr-2 flex items-center justify-center text-emerald-700">✓</span>
                         Current Plan
                       </div>
                    ) : (
                      // Regular Action Button
                      <button
                        onClick={() => user ? handlePlanChange(level.key) : handleLevelSelect(level.key)}
                        disabled={processingLevel === level.key}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        aria-label={user ? `Switch to ${level.key} plan` : `Select ${level.key} membership`}
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
                          user ? (
                            level.isRecurring ? 'Manage Billing' : `Switch to ${level.key.replace(/_/g, ' ')}`
                          ) : (
                            `Select ${level.key.replace(/_/g, ' ')}`
                          )
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                     <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold">?</span>
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
