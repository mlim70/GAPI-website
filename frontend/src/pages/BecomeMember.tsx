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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        {/* Simplified header section */}
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
          // Simplified Membership Level Selection
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
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
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
          <div className="flex items-center justify-center min-h-[600px]">
            <form onSubmit={(e) => { e.preventDefault(); handleCheckout(selectedLevel!); }} className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-xl border border-gray-100 space-y-6 relative">
              <button
                type="button"
                onClick={() => {
                  setShowRegistration(false);
                  setSelectedLevel(null);
                  setError('');
                }}
                className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-50"
                aria-label="Back to plans"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center mb-6 pt-4">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Registration</h2>
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Selected: <span className="font-semibold">{levels.find(l => l.key === selectedLevel)?.key.replace(/_/g, ' ')}</span>
                </div>
              </div>
              
              {displayError && (
                <div 
                  className="text-red-700 text-sm p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                  tabIndex={-1}
                  role="alert"
                  aria-live="polite"
                >
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{displayError}</span>
                </div>
              )}
              
              <div className="space-y-6">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="email">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent transition-all duration-200"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    autoComplete="email"
                    placeholder="your.email@gmail.com"
                  />
                  {formData.email && getEmailAliasWarning(formData.email) && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {getEmailAliasWarning(formData.email)}
                    </p>
                  )}
                </div>

                {/* Username Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                      formData.username && !validateUsername(formData.username).isValid
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-clay'
                    }`}
                    value={formData.username}
                    onChange={e => handleInputChange('username', e.target.value)}
                    autoComplete="username"
                    placeholder="e.g., john_doe123"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Letters, numbers, hyphens, and underscores only. Must start with a letter or number. 3-30 characters.
                  </p>
                  {formData.username && !validateUsername(formData.username).isValid && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {validateUsername(formData.username).error}
                    </p>
                  )}
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="firstName">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent transition-all duration-200"
                      value={formData.firstName}
                      onChange={e => handleInputChange('firstName', e.target.value)}
                      autoComplete="given-name"
                      placeholder="First"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="lastName">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent transition-all duration-200"
                      value={formData.lastName}
                      onChange={e => handleInputChange('lastName', e.target.value)}
                      autoComplete="family-name"
                      placeholder="last"
                    />
                  </div>
                </div>
                
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profilePic">
                    Profile Picture <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label htmlFor="profilePic" className="text-clay hover:text-clay-dark cursor-pointer font-medium text-sm px-4 py-2 border border-sand rounded-lg hover:bg-sand/20 transition-colors">
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
                  <p className="text-xs text-gray-500 mt-2">
                    JPEG, PNG, GIF, WebP. Max 5MB.
                  </p>
                </div>
                
                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="password">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className={`w-full border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          formData.password && !validatePassword(formData.password).isValid
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-clay'
                        }`}
                        value={formData.password}
                        onChange={e => handleInputChange('password', e.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {formData.password && !validatePassword(formData.password).isValid && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {validatePassword(formData.password).error}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="confirmPassword">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        className={`w-full border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          formData.confirmPassword && !validatePasswordMatch(formData.password, formData.confirmPassword).isValid
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-clay'
                        }`}
                        value={formData.confirmPassword}
                        onChange={e => handleInputChange('confirmPassword', e.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {formData.confirmPassword && !validatePasswordMatch(formData.password, formData.confirmPassword).isValid && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {validatePasswordMatch(formData.password, formData.confirmPassword).error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Terms Agreement */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  id="agree"
                  type="checkbox"
                  required
                  className="mt-1 accent-clay w-4 h-4"
                  checked={formData.agree}
                  onChange={e => handleInputChange('agree', e.target.checked)}
                />
                <label htmlFor="agree" className="text-sm text-gray-700 leading-relaxed">
                  I agree to the <a href="/terms" className="text-clay hover:text-clay-dark underline font-medium">Terms of Service</a> and <a href="/privacy" className="text-clay hover:text-clay-dark underline font-medium">Privacy Policy</a> <span className="text-red-500">*</span>
                </label>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={processingLevel === selectedLevel}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl active:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {processingLevel === selectedLevel ? (
                  <>
                    <div 
                      className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
                      aria-busy="true"
                      aria-label="Processing payment"
                    ></div>
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Proceed to Payment
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
} 