//frontend/src/pages/auth/PasswordReset.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Check, Key, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { API_URL } from '../../config/environment';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { logger } from '../../utils/logger';

interface PasswordResetResponse {
  success: boolean;
  message: string;
  error?: string;
  details?: string;
}

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // reCAPTCHA hook for forgot password
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({
    siteKey: RECAPTCHA_CONFIG.SITE_KEY,
    action: RECAPTCHA_CONFIG.ACTIONS.PASSWORD_RESET
  });

  // Check if reCAPTCHA is properly configured
  if (!RECAPTCHA_CONFIG.SITE_KEY) {
    logger.warn('⚠️ reCAPTCHA not configured - forgot password will fail on backend');
  }

  useEffect(() => {
    if (token && token.length > 0) {
      // User has reset link - show reset form
      setError(null);
    } else {
      // User needs to request reset - show forgot password form
      setError(null);
    }
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateResetForm = () => {
    if (!formData.newPassword) {
      setError('New password is required');
      return false;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Execute reCAPTCHA verification
      logger.info('🔍 Executing reCAPTCHA verification for forgot password...');
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
        logger.info('✅ reCAPTCHA token obtained for forgot password');
      } catch (recaptchaError) {
        logger.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry

        // Provide helpful error message based on the error
        if (recaptchaError instanceof Error && recaptchaError.message.includes('site key not configured')) {
          throw new Error('reCAPTCHA is not configured. Please contact support.');
        } else if (recaptchaError instanceof Error && recaptchaError.message.includes('Failed to load reCAPTCHA script')) {
          throw new Error('reCAPTCHA failed to load. Please check your internet connection and try again.');
        } else {
          throw new Error('reCAPTCHA verification failed. Please try again.');
        }
      }

      const response = await fetch(`${API_URL}/email/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          recaptchaToken
        }),
      });

      const data: PasswordResetResponse = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || data.details || 'Failed to send reset email');
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateResetForm()) return;

    // Validate we have a valid token
    if (!token || token.length === 0) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/email/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      });

      const data: PasswordResetResponse = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || data.details || 'Password reset failed');
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleContinueToLogin = () => {
    navigate('/auth/login');
  };

  // Forgot Password Form (no token)
  if (!token || token.length === 0) {
    logger.debug('🔍 PasswordReset - Rendering forgot password form (no valid token)');
    if (success) {
      logger.debug('🔍 PasswordReset - Rendering success message for forgot password');
      return (
        <div className="min-h-screen page-background flex items-center justify-center">
          <Card className="w-full max-w-md p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check Your Email</h2>
              <p className="text-gray-600 mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
                Click the link in your email to reset your password.
              </p>
              <Button onClick={() => navigate('/auth/login')} className="w-full">
                Return to Login
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen page-background flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <Key className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot Your Password?</h2>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
                placeholder="Enter your email address"
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/auth/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Invalid Reset Link
  if (error && (!token || token.length === 0)) {
    return (
      <div className="min-h-screen page-background flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Reset Link</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate('/auth/login')} className="w-full">
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Success State (after reset)
  if (success) {
    return (
      <div className="min-h-screen page-background flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Reset Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Button onClick={handleContinueToLogin} className="w-full">
              Continue to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Reset Password Form (has token/userId)
  return (
    <div className="min-h-screen page-background flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Key className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset Your Password</h2>
          <p className="text-gray-600">
            Enter your new password below to complete the reset process.
          </p>
        </div>

        <form onSubmit={handlePasswordReset} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
              placeholder="Confirm new password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isResetting}
            className="w-full"
          >
            {isResetting ? 'Resetting Password...' : 'Reset Password'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/auth/login')}
            className="w-full"
          >
            Return to Login
          </Button>
        </div>
      </Card>
    </div>
  );
}
