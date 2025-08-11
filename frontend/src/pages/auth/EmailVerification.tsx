import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';



export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);


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
      // Call the actual verification endpoint directly
      const response = await fetch(
        `http://localhost:4000/api/auth/verify-email?token=${token}&pendingUserId=${pendingUserId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        setError(null);
        // If verification is successful, mark as complete
        if (data.message === 'Email verified successfully') {
          setVerificationComplete(true);
        }
      } else {
        const errorData = await response.json();
        if (errorData.code === 'LINK_EXPIRED') {
          setError('This verification link has expired. Please request a new one.');
        } else if (errorData.code === 'REGISTRATION_EXPIRED') {
          setError('Your registration has expired. Please register again.');
        } else {
          setError(errorData.message || 'Invalid or expired verification token');
        }
      }
    } catch (err) {
      setError('Failed to validate token. Please try again.');
    } finally {
      setIsLoading(false);
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
          <div className="text-center">
            <p className="text-gray-600">
              Your email verification is being processed automatically...
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
