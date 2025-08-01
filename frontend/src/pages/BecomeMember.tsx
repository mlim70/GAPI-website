// frontend/src/pages/BecomeMember.tsx
import { useState, useRef, useEffect } from 'react';
import { useMembershipLevels } from '../hooks/useMembershipLevels.js';
import { useAccountData } from '../hooks/useAccountData.js';
import { loadStripe } from '@stripe/stripe-js';
import RegistrationForm from '../components/auth/RegistrationForm.js';
import CurrentPlanIndicator from '../components/auth/CurrentPlanIndicator.js';
import ErrorDisplay from '../components/common/ErrorDisplay.js';
import TokenManager from '../utils/tokenManager.js';
import { formatPrice } from '../utils/formatters.js';
import { RegistrationFormData } from '../types/index.js';



interface User {
  _id: string;
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  avatarUrl?: string;
  membershipLevel?: string;
}

interface BecomeMemberProps {
  user?: User | null;
  setUser?: (user: any) => void;
}



export default function BecomeMember({ user, setUser }: BecomeMemberProps) {
  const { levels, loading, error: levelsError } = useMembershipLevels();
  const { accountData, loading: accountLoading, error: accountError } = useAccountData();
  const [processingLevel, setProcessingLevel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  
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

  // Scroll to error when it changes
  useEffect(() => {
    if (displayError && errorRef.current) {
      const timeoutId = setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayError]);



  const handleCheckout = async (levelKey: string, formData: RegistrationFormData) => {
    setProcessingLevel(levelKey);
    setError('');
    
    try {
      // RegistrationForm component handles validation and passes the form data to this function

      // Create pending user with profile picture
      const pendingUserData = new FormData();
      // Send raw data and let backend handle normalization
      pendingUserData.append('email', formData.email);
      pendingUserData.append('username', formData.username);
      pendingUserData.append('password', formData.password);
      pendingUserData.append('firstName', formData.firstName);
      pendingUserData.append('lastName', formData.lastName);
      pendingUserData.append('levelKey', levelKey);
      
      if (formData.profilePic) {
        pendingUserData.append('profilePic', formData.profilePic);
      }

      // Test API connectivity first
      try {
        console.log('🔍 Testing API connectivity...');
        const healthResponse = await fetch('/api/health');
        console.log('🔍 Health check status:', healthResponse.status);
        if (!healthResponse.ok) {
          throw new Error(`API health check failed: ${healthResponse.status}`);
        }
      } catch (healthError) {
        console.error('❌ API health check failed:', healthError);
        throw new Error('Unable to connect to the server. Please try again later.');
      }

      console.log('🔗 Making pending user request to:', '/api/auth/pending-user');
      const pendingUserResponse = await fetch('/api/auth/pending-user', {
        method: 'POST',
        body: pendingUserData,
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

      const { pendingUserId, isUpdate } = await pendingUserResponse.json();
      
      if (isUpdate) {
        console.log('🔄 Resuming existing registration');
      } else {
        console.log('🆕 Starting new registration');
      }

      // Redirect to email verification page instead of directly to checkout
      console.log('📧 Redirecting to email verification page');
      window.location.href = `/email-verification?pendingUserId=${pendingUserId}`;
    } catch (err: any) {
      console.error('❌ Error in handleCheckout:', err);
      console.error('❌ Error stack:', err.stack);
      console.error('❌ Error name:', err.name);
      setError(err.message || 'Checkout failed');
      // Don't re-throw - let the parent handle all error display
    } finally {
      setProcessingLevel(null);
    }
  };

  const handlePlanChange = async (levelKey: string) => {
    try {
      // Get auth token
      const token = TokenManager.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Create Stripe checkout session for existing user
      console.log('🔗 Making checkout request for existing user to:', '/api/stripe/checkout');
      const checkoutResponse = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          levelKey,
          userId: user._id, // Use existing user ID
        }),
      });
      console.log('📡 Checkout response status (existing user):', checkoutResponse.status, checkoutResponse.statusText);

      if (!checkoutResponse.ok) {
        let errorMessage = 'Checkout failed';
        const textContent = await checkoutResponse.text();
        try {
          const errorData = JSON.parse(textContent);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the text content as is
          console.error('Non-JSON response from checkout endpoint (plan change):', textContent);
          errorMessage = `Server error: ${checkoutResponse.status} ${checkoutResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await checkoutResponse.json();
      console.log('📡 Checkout response body →', responseData);
      
      // Validate response data
      if (!responseData || typeof responseData !== 'object') {
        console.error('❌ Invalid response format:', responseData);
        throw new Error('Invalid response from server');
      }
      
      // *Backend always creates a checkout session for plan changes
      // Update plan through Stripe webhooks
      const { sessionId, sessionUrl } = responseData;
      
      // Validate sessionId exists and is a string
      const { sessionId: newSessionId, sessionUrl: newSessionUrl } = responseData;
      if (!newSessionId || typeof newSessionId !== 'string') {
        console.error('❌ Invalid sessionId in response:', responseData);
        throw new Error('Invalid checkout session received from server');
      }
      
      // Validate sessionId format (should start with 'cs_')
      if (!newSessionId.startsWith('cs_')) {
        console.error('❌ Invalid sessionId format:', newSessionId);
        throw new Error('Invalid checkout session format received from server');
      }
      
      // Use Stripe JS SDK for better reliability
      const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!stripePublishableKey) {
        throw new Error('Stripe configuration is missing');
      }
      
      const stripe = await loadStripe(stripePublishableKey);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
      console.log('🔄 Redirecting to Stripe checkout for plan change...');
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        throw new Error(error.message || 'Checkout failed');
      }
    } catch (err: any) {
      console.error('❌ Error in handlePlanChange:', err);
      console.error('❌ Error stack:', err.stack);
      console.error('❌ Error name:', err.name);
      setError(err.message || 'Plan change failed');
    }
  };

  const handleLevelSelect = (levelKey: string) => {
    setSelectedLevel(levelKey);
    setShowRegistration(true);
  };

  if (loading || (user && accountLoading)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto"
            aria-busy="true"
            aria-label="Loading membership options"
          ></div>
          <p className="mt-4 text-gray-600">
            {loading ? 'Loading membership options...' : 'Loading account data...'}
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
              className="text-4xl font-bold text-gray-900 mb-4"
              role="heading"
            >
              {user ? (
                <>
                  Welcome{' '}
                  <span className="text-emerald-600">
                    {user.username}
                  </span>
                  !
                </>
              ) : (
                'Become a GAPI Member'
              )}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
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
            ref={errorRef}
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
                className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 flex flex-col h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  {/* Header with name and badge */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 capitalize">{level.key.replace(/_/g, ' ')}</h3>
                    {user && getCurrentMembershipLevel() === level.key && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        Current Plan
                      </span>
                    )}
                  </div>
                  
                  {/* Price display */}
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-emerald-600">
                      {formatPrice(level.unitAmount, level.currency, level.interval, level.intervalCount)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
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
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
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
                            Processing...
                          </>
                        ) : (
                          user ? `Switch to ${level.key.replace(/_/g, ' ')}` : `Select ${level.key.replace(/_/g, ' ')}`
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
      </div>
    </div>
  );
} 
