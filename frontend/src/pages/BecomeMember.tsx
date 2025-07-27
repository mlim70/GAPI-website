// frontend/src/pages/BecomeMember.tsx
import { useState, useEffect } from 'react';

interface MembershipLevel {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isRecurring: boolean;
}

export default function BecomeMember() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembershipLevels();
  }, []);

  const fetchMembershipLevels = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/membership-levels');
      if (!response.ok) throw new Error('Failed to fetch membership levels');
      const data = await response.json();
      setLevels(data);
    } catch (err) {
      setError('Failed to load membership levels');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (levelKey: string) => {
    setCheckoutLoading(true);
    setError('');
    
    try {
      // For demo purposes, using a placeholder userId
      // In a real app, this would come from user authentication
      const response = await fetch('http://localhost:4000/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          levelKey,
          userId: 'demo-user-id', // This should be the actual user ID in production
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Checkout failed');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading membership options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Become a GAPI Member
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join our community and unlock exclusive benefits, resources, and networking opportunities.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

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
                    onClick={() => handleCheckout(level.key)}
                    disabled={checkoutLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
                  >
                    {checkoutLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      `Join ${level.name}`
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

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