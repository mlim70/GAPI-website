import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Eye, EyeOff } from 'lucide-react';
import { RegistrationFormData } from '../../types/index.js';

interface RegistrationFormProps {
  selectedLevel: string | null;
  processingLevel: string | null;
  onCheckout: (levelKey: string, formData: RegistrationFormData) => Promise<void>;
  onBack: () => void;
  error: string;
}

// Validation schema using Yup
const validationSchema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  username: yup
    .string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .matches(
      /^[A-Za-z0-9][A-Za-z0-9-_]{1,28}[A-Za-z0-9]$/,
      'Username must contain only letters, numbers, hyphens, and underscores, and start/end with alphanumeric'
    ),
  firstName: yup
    .string()
    .required('First name is required'),
  lastName: yup
    .string()
    .required('Last name is required'),
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
  profilePic: yup
    .mixed()
    .nullable()
    .test('fileSize', 'Profile picture must be less than 5MB', (value) => {
      if (!value) return true;
      return (value as File).size <= 5 * 1024 * 1024;
    })
    .test('fileType', 'Profile picture must be a valid image file (JPEG, PNG, GIF, or WebP)', (value) => {
      if (!value) return true;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return allowedTypes.includes((value as File).type);
    }),
  agree: yup
    .boolean()
    .required('You must agree to the terms and conditions')
    .oneOf([true], 'You must agree to the terms and conditions')
});

export default function RegistrationForm({ 
  selectedLevel, 
  processingLevel, 
  onCheckout, 
  onBack, 
  error
}: RegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
    setValue,
    watch,
    reset,
    trigger
  } = useForm<RegistrationFormData>({
    resolver: yupResolver(validationSchema) as any,
    mode: 'onChange', // Validate on change to enable button when all fields are valid
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      profilePic: null,
      agree: false,
    }
  });

  const watchedProfilePic = watch('profilePic');
  const watchedPassword = watch('password');

  // Cleanup image preview URL when component unmounts or when profilePic changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Re-validate confirm password when password changes
  useEffect(() => {
    if (watchedPassword) {
      trigger('confirmPassword');
    }
  }, [watchedPassword, trigger]);

  // Handle profile picture changes
  useEffect(() => {
    if (watchedProfilePic) {
      try {
        const newPreviewUrl = URL.createObjectURL(watchedProfilePic);
        setImagePreviewUrl(newPreviewUrl);
      } catch (error) {
        console.error('Failed to create image preview:', error);
      }
    } else {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }
    }
  }, [watchedProfilePic]);

  const handleProfilePicChange = (file: File | null) => {
    setValue('profilePic', file, { shouldValidate: true });
    
    if (!file) {
      setFileInputKey(prev => prev + 1);
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    if (!selectedLevel) return;
    await onCheckout(selectedLevel, data);
  };

  const getInputClasses = (fieldName: string) => {
    const baseClasses = "w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-red focus:border-transparent transition-all duration-200";
    const hasError = errors[fieldName as keyof RegistrationFormData];
    
    return `${baseClasses} ${hasError ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-red'}`;
  };

  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-xl border border-gray-100 space-y-6 relative">
        <button
          type="button"
          onClick={onBack}
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
            Selected: <span className="font-semibold">{selectedLevel?.replace(/_/g, ' ')}</span>
          </div>
        </div>
        
        {error && (
          <div 
            ref={errorRef}
            className="text-red-700 text-sm p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            tabIndex={-1}
            role="alert"
            aria-live="polite"
          >
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="email"
                  type="email"
                  required
                  className={getInputClasses('email')}
                  autoComplete="email"
                  placeholder="your.email@gmail.com"
                />
              )}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Username Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="username">
              Username <span className="text-red-500">*</span>
            </label>
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={30}
                  className={getInputClasses('username')}
                  autoComplete="username"
                  placeholder="e.g., john_doe123"
                />
              )}
            />
            {errors.username ? (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.username.message}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Letters, numbers, hyphens, and underscores only. Must start with a letter or number. 3-30 characters.
              </p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="firstName">
                First Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    id="firstName"
                    type="text"
                    required
                    minLength={1}
                    maxLength={50}
                    className={getInputClasses('firstName')}
                    autoComplete="given-name"
                    placeholder="John"
                  />
                )}
              />
              {errors.firstName && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="lastName">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    id="lastName"
                    type="text"
                    required
                    minLength={1}
                    maxLength={50}
                    className={getInputClasses('lastName')}
                    autoComplete="family-name"
                    placeholder="Doe"
                  />
                )}
              />
              {errors.lastName && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Profile Picture <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer"
                aria-label="Upload profile picture"
              >
                {imagePreviewUrl ? (
                  <div className="relative">
                    <img
                      className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 group-hover:border-red transition-all duration-200"
                      src={imagePreviewUrl}
                      alt="Profile preview"
                    />
                    <div className="absolute inset-0 rounded-full bg-black opacity-0 group-hover:opacity-20 flex items-center justify-center transition-all duration-200">
                      <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 group-hover:border-red transition-colors cursor-pointer">
                    <svg className="w-8 h-8 text-gray-400 group-hover:text-red transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </button>
              
              <input
                key={fileInputKey}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleProfilePicChange(e.target.files?.[0] || null)}
              />
              
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  {watchedProfilePic ? watchedProfilePic.name : 'No file selected'}
                </p>
                <p className="text-xs text-gray-500">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
                {imagePreviewUrl && (
                  <button
                    type="button"
                    onClick={() => handleProfilePicChange(null)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {errors.profilePic && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.profilePic.message}
              </p>
            )}
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="password">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className={`${getInputClasses('password')} pr-12`}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="confirmPassword">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      className={`${getInputClasses('confirmPassword')} pr-12`}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Terms Agreement */}
        <div className={`flex items-start gap-3 p-4 rounded-lg ${errors.agree ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
          <Controller
            name="agree"
            control={control}
            render={({ field }) => (
              <input
                id="agree"
                type="checkbox"
                required
                className="mt-1 accent-clay w-4 h-4"
                checked={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <label htmlFor="agree" className="text-sm text-gray-700 leading-relaxed">
            I agree to the <Link to="/terms-conditions" className="text-red hover:text-red-dark underline font-medium">Terms of Service</Link> and <Link to="/privacy-policy" className="text-red hover:text-red-dark underline font-medium">Privacy Policy</Link> <span className="text-red-500">*</span>
          </label>
        </div>
        {errors.agree && (
          <p className="text-red-600 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.agree.message}
          </p>
        )}
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={processingLevel === selectedLevel || !isValid}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl active:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {processingLevel === selectedLevel ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" aria-busy="true" aria-label="Processing payment"></div>
              Processing Payment...
            </>
          ) : (
            <>Proceed to Payment</>
          )}
        </button>
      </form>
    </div>
  );
} 
