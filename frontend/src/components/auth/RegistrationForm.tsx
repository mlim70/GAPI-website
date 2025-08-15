import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Eye, EyeOff, X, AlertCircle, CheckCircle, User, ArrowLeft } from 'lucide-react';
import { RegistrationFormData } from '../../types/index';

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

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
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
      agree: false,
    }
  });

  // Re-validate confirm password when password changes
  useEffect(() => {
    const password = watch('password');
    if (password) {
      trigger('confirmPassword');
    }
  }, [watch, trigger]);

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
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center mb-6 pt-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Start Your Registration</h2>
          <p className="text-gray-600 mb-3">Fill out the form below to begin the registration process</p>
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Selected: <span className="font-semibold">{selectedLevel?.replace(/_/g, ' ')}</span>
          </div>
        </div>
        
        {error && (
          <div 
            className="text-red-700 text-sm p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            tabIndex={-1}
            role="alert"
            aria-live="polite"
          >
            <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
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
                <AlertCircle className="w-4 h-4" />
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
                <AlertCircle className="w-4 h-4" />
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
                  <AlertCircle className="w-4 h-4" />
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
                  <AlertCircle className="w-4 h-4" />
                  {errors.lastName.message}
                </p>
              )}
            </div>
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
                  <AlertCircle className="w-4 h-4" />
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
                  <AlertCircle className="w-4 h-4" />
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
            <AlertCircle className="w-4 h-4" />
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
        
        {/* Payment Required Notice */}
        <p className="text-sm text-gray-600 text-center mt-3">
          <strong>Note:</strong> Your account will be created automatically after successful payment completion.
        </p>
      </form>
    </div>
  );
} 
