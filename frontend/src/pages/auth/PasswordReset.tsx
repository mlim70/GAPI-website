import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Check, Key } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { env } from '../../config/environment';

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
  
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!token || !userId) {
      setError('Invalid password reset link. Missing token or user ID.');
    }
  }, [token, userId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.newPassword) {
      setError('New password is required');
      return false;
    }
    
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch(`${env.apiUrl}/email/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          userId,
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

  if (error && (!token || !userId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter new password"
              required
              minLength={8}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
