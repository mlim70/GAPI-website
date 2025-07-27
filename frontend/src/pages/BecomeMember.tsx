// frontend/src/pages/BecomeMember.tsx
import { useState, useEffect } from 'react';
import { useMembershipLevels } from '../hooks/useMembershipLevels.js';

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

export default function BecomeMember() {
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

  const API_URL = import.meta.env.VITE_API_URL || '';

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
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    if (!formData.email.includes('@')) {
      return 'Please enter a valid email address.';
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
      // Validate form data
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      // Create pending user
      const pendingUserResponse = await fetch(`${API_URL}/api/auth/pending-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          levelKey,
        }),
      });

      if (!pendingUserResponse.ok) {
        const errorData = await pendingUserResponse.json();
        throw new Error(errorData.message || 'Failed to create user account');
      }

      const { userId } = await pendingUserResponse.json();

      // Create Stripe checkout session
      const checkoutResponse = await fetch(`${API_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          levelKey,
          userId,
        }),
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        throw new Error(errorData.message || 'Checkout failed');
      }

      const { url } = await checkoutResponse.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setProcessingLevel(null);
    }
  };

  const handleLevelSelect = (levelKey: string) => {
    setSelectedLevel(levelKey);
    setShowRegistration(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
            aria-busy="true"
            aria-label="Loading membership options"
          ></div>
          <p className="mt-4 text-gray-600">Loading membership options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 
            className="text-4xl font-bold text-gray-900 mb-4"
            role="heading"
          >
            Become a GAPI Member
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
                className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">{level.name}</h3>
                    {level.isRecurring && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Recurring
                      </span>
                    )}
                  </div>
                  
                  {level.description && (
                    <p className="text-gray-600 mb-6">{level.description}</p>
                  )}

                  <div className="space-y-4">
                    <button
                      onClick={() => handleLevelSelect(level.key)}
                      disabled={processingLevel === level.key}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
                      aria-label={`Select ${level.name} membership`}
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
                        `Select ${level.name}`
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Registration Form
          <div className="flex min-h-screen items-center justify-center">
            <form onSubmit={(e) => { e.preventDefault(); handleCheckout(selectedLevel!); }} className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-clay">Complete Your Registration</h2>
                <p className="text-gray-600 mt-2">
                  Selected: <span className="font-semibold">{levels.find(l => l.key === selectedLevel)?.name}</span>
                </p>
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
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1" htmlFor="username">Username *</label>
                  <input
                    id="username"
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={formData.username}
                    onChange={e => handleInputChange('username', e.target.value)}
                    autoComplete="username"
                  />
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
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistration(false);
                    setSelectedLevel(null);
                    setError('');
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded transition"
                >
                  Back to Plans
                </button>
                <button
                  type="submit"
                  disabled={processingLevel === selectedLevel}
                  className="flex-1 bg-clay text-white font-semibold py-2 rounded hover:bg-clay/90 transition disabled:opacity-50 flex items-center justify-center"
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
              </div>
            </form>
          </div>
        )}

        <div className="mt-12 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Test Payment Information
            </h3>
            <p className="text-blue-800 text-sm">
              Use test card: <code className="bg-blue-100 px-2 py-1 rounded">4242 4242 4242 4242</code>
            </p>
            <p className="text-blue-700 text-sm mt-1">
              Any future date for expiry, any 3-digit CVC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 