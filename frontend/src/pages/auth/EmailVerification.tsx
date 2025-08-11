import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

interface TokenValidationResponse {
  valid: boolean;
  email: string;
  pendingUserId: string;
  type: string;
  error?: string;
}

interface VerificationResponse {
  success: boolean;
  message: string;
  email: string;
  error?: string;
  details?: string;
}

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  
  const token = searchParams.get('token');
  const pendingUserId = searchParams.get('pendingUserId');

  useEffect(() => {
    if (!token || !pendingUserId) {
      setError('Invalid verification link. Missing token or user ID.');
      setIsLoading(false);
      return;
    }

    validateToken();
  }, [token, pendingUserId]);

  const validateToken = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/email/check-token/${token}?pendingUserId=${pendingUserId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data: TokenValidationResponse = await response.json();

      if (data.valid) {
        setTokenValid(true);
        setError(null);
      } else {
        setError(data.error || 'Invalid or expired verification token');
      }
    } catch (err) {
      setError('Failed to validate token. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!token || !pendingUserId) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:4000/api/email/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          pendingUserId,
        }),
      });

      const data: VerificationResponse = await response.json();

      if (data.success) {
        setVerificationComplete(true);
      } else {
        setError(data.error || data.details || 'Verification failed');
      }
    } catch (err) {
      setError('Failed to verify email. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleContinueToLogin = () => {
    navigate('/auth/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900">Validating verification link...</h2>
            <p className="text-gray-600 mt-2">Please wait while we verify your token.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate('/auth/login')} className="w-full">
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (verificationComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Verified Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your email has been verified. You can now log in to your account and complete your membership registration.
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
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-6">
            Click the button below to verify your email address and complete your registration.
          </p>
          <Button 
            onClick={handleVerification} 
            disabled={isVerifying}
            className="w-full"
          >
            {isVerifying ? 'Verifying...' : 'Verify Email Address'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
