// frontend/src/pages/BecomeMember.tsx
import { useState } from 'react';
import { useMembershipLevels } from '../hooks/useMembershipLevels.js';
import { loadStripe } from '@stripe/stripe-js';
import { validateUsername, validateEmail, validatePassword, validatePasswordMatch } from '../utils/validation.js';
import { getEmailAliasWarning } from '../utils/emailUtils.js';

interface RegistrationForm {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  profilePic: File | null;
  agree: boolean;
}

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
  const [formData, setFormData] = useState<RegistrationForm>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    profilePic: null,
    agree: false,
  });

  // Combine errors from hook and local state
  const displayError = levelsError || error;

  const handleInputChange = (field: keyof RegistrationForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateProfilePic = (file: File): string | null => {
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return 'Profile picture must be less than 5MB.';
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Profile picture must be a valid image file (JPEG, PNG, GIF, or WebP).';
    }

    return null;
  };

  const handleProfilePicChange = (file: File | null) => {
    if (file) {
      const validationError = validateProfilePic(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setFormData(prev => ({ ...prev, profilePic: file }));
    setError(''); // Clear any previous errors
  };

  const validateForm = (): string | null => {
    if (!formData.email || !formData.username || !formData.password || 
        !formData.confirmPassword || !formData.firstName || !formData.lastName) {
      return 'Please fill in all required fields.';
    }
    
    // Use validation utilities
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      return emailValidation.error || 'Invalid email address.';
    }
    
    const usernameValidation = validateUsername(formData.username);
    if (!usernameValidation.isValid) {
      return usernameValidation.error || 'Invalid username.';
    }
    
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      return passwordValidation.error || 'Invalid password.';
    }
    
    const passwordMatchValidation = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (!passwordMatchValidation.isValid) {
      return passwordMatchValidation.error || 'Passwords do not match.';
    }
    
    if (!formData.agree) {
      return 'You must agree to the Terms & Privacy Policy.';
    }
    return null;
  };

  const handleCheckout = async (levelKey: string) => {
    setProcessingLevel(levelKey);
    setError('');
    
    try {
      // If user is logged in, handle plan change
      if (user) {
        await handlePlanChange(levelKey);
        return;
      }

      // Validate form data for new registration
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
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

      const { pendingUserId } = await pendingUserResponse.json();

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
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 
            className="text-4xl font-bold text-gray-900 mb-4"
            role="heading"
          >
            {user ? (
              <>
                Welcome{' '}
                <span className="text-emerald-600 bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
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
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {levels.map((level) => (
              <div
                key={level._id}
                className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300 flex flex-col h-full"
              >
                <div className="p-8 flex flex-col h-full">
                  {/* Header with name and badge */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 capitalize">{level.key.replace(/_/g, ' ')}</h3>
                    {level.isRecurring && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Recurring
                      </span>
                    )}
                  </div>
                  
                  {/* Price display */}
                  <div className="mb-6">
                    <div className="text-3xl font-bold text-blue-600">
                      {formatPrice(level.unitAmount, level.currency, level.interval, level.intervalCount)}
                    </div>
                    {!level.isRecurring && (
                      <div className="text-sm text-gray-500 mt-1">One-time payment</div>
                    )}
                  </div>
                  
                  {/* Description */}
                  {level.description && (
                    <p className="text-gray-600 mb-8 flex-grow">{level.description}</p>
                  )}
                  
                  {/* Action button */}
                  <div className="mt-auto">
                    <button
                      onClick={() => user ? handleCheckout(level.key) : handleLevelSelect(level.key)}
                      disabled={processingLevel === level.key}
                      className="w-full bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-50"
                      aria-label={user ? `Change to ${level.key} plan` : `Select ${level.key} membership`}
                    >
                      {processingLevel === level.key ? (
                        <>
                          <div 
                            className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"
                            aria-busy="true"
                            aria-label="Processing selection"
                          ></div>
                          Processing...
                        </>
                      ) : (
                        user ? `Change to ${level.key.replace(/_/g, ' ')}` : `Select ${level.key.replace(/_/g, ' ')}`
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Registration Form
          <div className="flex items-center justify-center">
            <form onSubmit={(e) => { e.preventDefault(); handleCheckout(selectedLevel!); }} className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md space-y-4 relative">
              <button
                type="button"
                onClick={() => {
                  setShowRegistration(false);
                  setSelectedLevel(null);
                  setError('');
                }}
                className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Back to plans"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-clay">Complete Your Registration</h2>
                <p className="text-gray-600 mt-2">
                  Selected: <span className="font-semibold">{levels.find(l => l.key === selectedLevel)?.key.replace(/_/g, ' ')}</span>
                </p>
                {selectedLevel && levels.find(l => l.key === selectedLevel) && (
                  <p className="text-clay font-semibold mt-1">
                    {formatPrice(
                      levels.find(l => l.key === selectedLevel)!.unitAmount,
                      levels.find(l => l.key === selectedLevel)!.currency,
                      levels.find(l => l.key === selectedLevel)!.interval,
                      levels.find(l => l.key === selectedLevel)!.intervalCount
                    )}
                  </p>
                )}
              </div>
              
              {displayError && (
                <div 
                  className="text-red-600 text-sm text-center p-3 bg-red-50 border border-red-200 rounded-md"
                  tabIndex={-1}
                  role="alert"
                  aria-live="polite"
                >
                  {displayError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1" htmlFor="email">Email *</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    autoComplete="email"
                    placeholder="your.email@gmail.com"
                  />
                  {formData.email && getEmailAliasWarning(formData.email) && (
                    <p className="text-xs text-blue-600 mt-1">
                      {getEmailAliasWarning(formData.email)}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1" htmlFor="username">Username *</label>
                  <input
                    id="username"
                    type="text"
                    required
                    className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent ${
                      formData.username && !validateUsername(formData.username).isValid
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                    value={formData.username}
                    onChange={e => handleInputChange('username', e.target.value)}
                    autoComplete="username"
                    placeholder="e.g., john_doe123"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Letters, numbers, hyphens, and underscores only. Must start with a letter or number. 3-30 characters.
                  </p>
                  {formData.username && !validateUsername(formData.username).isValid && (
                    <p className="text-xs text-red-500 mt-1">
                      {validateUsername(formData.username).error}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium mb-1" htmlFor="firstName">First Name *</label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.firstName}
                    onChange={e => handleInputChange('firstName', e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium mb-1" htmlFor="lastName">Last Name *</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.lastName}
                    onChange={e => handleInputChange('lastName', e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
                
                {/* Profile Picture */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1" htmlFor="profilePic">Profile Picture</label>
                  <div className="flex items-center gap-3">
                    <label htmlFor="profilePic" className="text-clay px-4 py-2 rounded cursor-pointer border border-sand hover:bg-sand/18 transition text-sm font-medium">
                      {formData.profilePic ? 'Change File' : 'Choose File'}
                    </label>
                    <span className="text-sm text-gray-600 truncate max-w-xs">
                      {formData.profilePic ? formData.profilePic.name : 'No file chosen'}
                    </span>
                    <input
                      id="profilePic"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={e => handleProfilePicChange(e.target.files?.[0] || null)}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepted formats: JPEG, PNG, GIF, WebP. Max size: 5MB.
                  </p>
                </div>
                
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium mb-1" htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type="password"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">Confirm Password *</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.confirmPassword}
                    onChange={e => handleInputChange('confirmPassword', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  id="agree"
                  type="checkbox"
                  required
                  className="mr-2 accent-clay"
                  checked={formData.agree}
                  onChange={e => handleInputChange('agree', e.target.checked)}
                />
                <label htmlFor="agree" className="text-sm">
                  I agree to the <a href="/terms" className="underline text-clay">Terms</a> & <a href="/privacy" className="underline text-clay">Privacy Policy</a> *
                </label>
              </div>
              
              <button
                type="submit"
                disabled={processingLevel === selectedLevel}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 active:from-blue-600 active:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl active:shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
              >
                {processingLevel === selectedLevel ? (
                  <>
                    <div 
                      className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"
                      aria-busy="true"
                      aria-label="Processing payment"
                    ></div>
                    Processing...
                  </>
                ) : (
                  'Proceed to Payment'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
} 