import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Check, Mail, Lock } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';



export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<any>(null);

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

    fetchPendingUser();
  }, [token, pendingUserId]);

  const fetchPendingUser = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/auth/pending-user/${pendingUserId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const userData = await response.json();
        setPendingUser(userData);
        // Now fetch the user, proceed with token validation
        validateToken();
      } else {
        setError('Failed to fetch user information. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to fetch user information. Please try again.');
      setIsLoading(false);
    }
  };

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
              <X className="h-6 w-6 text-red-600" />
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
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Verified Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your email has been verified. <strong>Your account will be created automatically once you complete your payment.</strong> You can now proceed to checkout to finalize your membership.
            </p>
            <Button onClick={handleContinueToLogin} className="w-full">
              Continue to Checkout
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
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-6">
            Click the button below to verify your email address. <strong>After verification, you'll need to complete payment to create your account.</strong>
          </p>
          <div className="text-center">
            <p className="text-gray-600">
              Your email verification is being processed automatically...
            </p>
            
            {/* Process Explanation */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-sm mx-auto">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">After verification:</p>
                  <p className="text-blue-700">Complete payment to create your account</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
