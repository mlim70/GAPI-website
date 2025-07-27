// frontend/src/pages/Account.tsx
import { useState, useEffect } from 'react';
import TokenManager from '../utils/tokenManager.js';

interface AccountData {
  profile: {
    _id: string;
    email: string;
    username: string;
    name: {
      first: string;
      last: string;
    };
    avatarUrl?: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    _id: string;
    status: string;
    startDate: string;
    nextBillDate?: string;
    cancelDate?: string;
    membershipLevel: {
      _id: string;
      key: string;
      name: string;
      description?: string;
      unitAmount: number;
      currency: string;
      isRecurring: boolean;
    };
  } | null;
  paymentHistory: {
    orders: Array<{
      _id: string;
      membershipLevel: {
        _id: string;
        name: string;
        key: string;
      };
      totalCents: number;
      currency: string;
      status: string;
      paidAt: string;
      gatewayPaymentId: string;
    }>;
    totalSpent: number;
    orderCount: number;
  };
}

export default function Account() {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const token = TokenManager.getToken();
        if (!token) {
          setError('Please log in to view your account');
          setLoading(false);
          return;
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const response = await fetch(`${API_URL}/api/account/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch account data');
        }

        const data = await response.json();
        setAccountData(data);
      } catch (err) {
        console.error('Error fetching account data:', err);
        setError('Failed to load account data');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, []);

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!accountData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No account data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center space-x-6">
            <div className="flex-shrink-0">
              {accountData.profile.avatarUrl ? (
                <img
                  className="h-20 w-20 rounded-full object-cover"
                  src={accountData.profile.avatarUrl}
                  alt="Profile"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {accountData.profile.name.first[0]}{accountData.profile.name.last[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {accountData.profile.name.first} {accountData.profile.name.last}
              </h1>
              <p className="text-lg text-gray-600">@{accountData.profile.username}</p>
              <p className="text-gray-500">{accountData.profile.email}</p>
              <p className="text-sm text-gray-400">
                Member since {formatDate(accountData.profile.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {accountData.profile.role}
              </span>
            </div>
          </div>
        </div>

        {/* Membership Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Membership</h2>
          
          {accountData.subscription ? (
            // Active subscription (recurring membership)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {accountData.subscription.membershipLevel.name}
                </h3>
                <p className="text-gray-600 mb-4">
                  {accountData.subscription.membershipLevel.description || 'No description available'}
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      accountData.subscription.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {accountData.subscription.status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Started:</span> {formatDate(accountData.subscription.startDate)}
                  </p>
                  {accountData.subscription.nextBillDate && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Next billing:</span> {formatDate(accountData.subscription.nextBillDate)}
                    </p>
                  )}
                  {accountData.subscription.cancelDate && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Cancelled:</span> {formatDate(accountData.subscription.cancelDate)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(accountData.subscription.membershipLevel.unitAmount, accountData.subscription.membershipLevel.currency)}
                </p>
                <p className="text-gray-500">
                  {accountData.subscription.membershipLevel.isRecurring ? 'per month' : 'one-time'}
                </p>
              </div>
            </div>
          ) : accountData.paymentHistory.orders.length > 0 ? (
            // No active subscription but has payment history (lifetime membership)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {accountData.paymentHistory.orders[0].membershipLevel.name}
                </h3>
                <p className="text-gray-600 mb-4">
                  Lifetime membership - no recurring payments
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Status:</span>{' '}
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ACTIVE
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Purchased:</span> {formatDate(accountData.paymentHistory.orders[0].paidAt)}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Type:</span> Lifetime Membership
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(accountData.paymentHistory.orders[0].totalCents, accountData.paymentHistory.orders[0].currency)}
                </p>
                <p className="text-gray-500">one-time payment</p>
              </div>
            </div>
          ) : (
            // No membership found
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No active membership found</p>
              <a 
                href="/become-a-member" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 