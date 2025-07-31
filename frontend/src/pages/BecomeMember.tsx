// frontend/src/pages/BecomeMember.tsx
import { useState } from 'react';
import { useMembershipLevels } from '../hooks/useMembershipLevels.js';
import { loadStripe } from '@stripe/stripe-js';
import RegistrationForm from '../components/RegistrationForm.js';



interface User {
  _id: string;
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  avatarUrl?: string;
}

interface BecomeMemberProps {
  user?: User | null;
}

// Helper function to format price
const formatPrice = (unitAmount: number, currency: string, interval?: string, intervalCount?: number) => {
  const amount = unitAmount / 100; // Convert cents to dollars
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
  
  if (interval && intervalCount) {
    const intervalText = intervalCount > 1 ? `${intervalCount} ${interval}s` : interval;
    return `${formattedAmount}/${intervalText}`;
  }
  
  return formattedAmount;
};

export default function BecomeMember({ user }: BecomeMemberProps) {
  const { levels, loading, error: levelsError } = useMembershipLevels();
  const [processingLevel, setProcessingLevel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Combine errors from hook and local state
  const displayError = levelsError || error;

  const handleCheckout = async (levelKey: string, formData?: any) => {
    setProcessingLevel(levelKey);
    setError('');
    
    try {
      // If user is logged in, handle plan change
      if (user) {
        await handlePlanChange(levelKey);
        return;
      }

      // RegistrationForm component handles validation and passes the form data to this function
      console.log('Starting checkout process for level:', levelKey);
      
      if (!formData) {
        throw new Error('Form data is required for registration');
      }

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

      // Create Stripe checkout session
      console.log('🔗 Making checkout request to:', '/api/stripe/checkout');
      const checkoutResponse = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          levelKey,
          pendingUserId,
        }),
      });
      console.log('📡 Checkout response status:', checkoutResponse.status, checkoutResponse.statusText);

      if (!checkoutResponse.ok) {
        let errorMessage = 'Checkout failed';
        const textContent = await checkoutResponse.text();
        try {
          const errorData = JSON.parse(textContent);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the text content as is
          console.error('Non-JSON response from checkout endpoint:', textContent);
          errorMessage = `Server error: ${checkoutResponse.status} ${checkoutResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const { sessionId } = await checkoutResponse.json();
      
      // Use Stripe JS SDK for better reliability
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        throw new Error(error.message || 'Checkout failed');
      }
    } catch (err: any) {
      console.error('❌ Error in handleCheckout:', err);
      console.error('❌ Error stack:', err.stack);
      console.error('❌ Error name:', err.name);
      setError(err.message || 'Checkout failed');
    } finally {
      setProcessingLevel(null);
    }
  };

  const handlePlanChange = async (levelKey: string) => {
    try {
      // Get auth token
      const token = localStorage.getItem('token');
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
      
      // Check if this was a direct plan update (no checkout session needed)
      if (responseData.success) {
        console.log('✅ Plan updated successfully:', responseData.message);
        
        // Update the user's membership level in localStorage
        if (user) {
          const updatedUser = { ...user, membershipLevel: levelKey };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          console.log('✅ Updated user state with new membership level:', levelKey);
        }
        return;
      }
      
      // Otherwise, proceed with checkout session
      const { sessionId } = responseData;
      
      // Use Stripe JS SDK for better reliability
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-clay mx-auto"
            aria-busy="true"
            aria-label="Loading membership options"
          ></div>
          <p className="mt-4 text-gray-600">Loading membership options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header section */}
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
        </div>

        {displayError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{displayError}</p>
              </div>
            </div>
          </div>
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
                    <button
                      onClick={() => user ? handleCheckout(level.key) : handleLevelSelect(level.key)}
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