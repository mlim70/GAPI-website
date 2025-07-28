// frontend/src/pages/Account.tsx
import { useState, useEffect, useRef } from 'react';
import TokenManager from '../utils/tokenManager.js';
import { Edit } from 'lucide-react';

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
        interval?: string;
        intervalCount?: number;
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

export default function Account({ setUser }: { setUser?: (user: any) => void }) {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    avatarUrl: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

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

  const formatBillingInterval = (isRecurring: boolean, interval?: string, intervalCount?: number) => {
    if (!isRecurring) return 'one-time payment';
    
    if (!interval) return 'per month'; // fallback
    
    // Handle interval counts (e.g., every 3 months, every 6 months)
    if (intervalCount && intervalCount > 1) {
      const intervalName = intervalCount === 1 ? interval : `${interval}s`;
      return `every ${intervalCount} ${intervalName}`;
    }
    
    // Handle different intervals
    switch (interval) {
      case 'month':
        return 'per month';
      case 'year':
        return 'per year';
      case 'week':
        return 'per week';
      case 'day':
        return 'per day';
      default:
        return `per ${interval}`;
    }
  };

  const handleEditClick = () => {
    if (accountData) {
      setEditForm({
        username: accountData.profile.username,
        firstName: accountData.profile.name.first,
        lastName: accountData.profile.name.last,
        avatarUrl: accountData.profile.avatarUrl || ''
      });
      setIsEditing(true);
      setUpdateError(null);
      setUpdateSuccess(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setUpdateError(null);
    setUpdateSuccess(null);
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const token = TokenManager.getToken();
      if (!token) {
        setUpdateError('Please log in to upload avatar');
        return;
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_URL}/api/account/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload avatar');
      }

      const data = await response.json();
      setEditForm(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      setUpdateSuccess('Avatar uploaded successfully!');
      
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setUpdateError(err.message || 'Failed to upload avatar');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUpdateError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUpdateError('File size must be less than 5MB');
        return;
      }

      handleAvatarUpload(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const token = TokenManager.getToken();
      if (!token) {
        setUpdateError('Please log in to update your profile');
        setUpdateLoading(false);
        return;
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_URL}/api/account/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: editForm.username,
          name: {
            first: editForm.firstName,
            last: editForm.lastName
          },
          avatarUrl: editForm.avatarUrl || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      setAccountData(prev => prev ? {
        ...prev,
        profile: data.profile
      } : null);
      setUpdateSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Update the user in TokenManager and localStorage
      TokenManager.setUser(data.profile);
      
      // Update the App state if setUser is provided
      if (setUser) {
        setUser(data.profile);
      }
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setUpdateError(err.message || 'Failed to update profile');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-light flex items-center justify-center">
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
      <div className="min-h-screen bg-neutral-light flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No account data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 relative">
          {!isEditing ? (
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
              <button
                onClick={handleEditClick}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-clay transition-colors"
                aria-label="Edit profile"
              >
                <Edit size={20} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
                          <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group cursor-pointer"
                  aria-label="Change profile picture"
                >
                  {editForm.avatarUrl ? (
                    <div className="relative">
                      <img
                        className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 group-hover:border-clay transition-all duration-200 group-hover:brightness-75"
                        src={editForm.avatarUrl}
                        alt="Profile"
                      />
                      <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Edit className="text-white w-6 h-6 drop-shadow-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200 group-hover:border-clay transition-colors cursor-pointer relative">
                      <span className="text-2xl font-bold text-blue-600">
                        {editForm.firstName[0]}{editForm.lastName[0]}
                      </span>
                      <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Edit className="text-white w-6 h-6 drop-shadow-lg" />
                      </div>
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="avatarFile"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Profile</h2>
                
                {updateError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                    {updateError}
                  </div>
                )}
                
                {updateSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
                    {updateSuccess}
                  </div>
                )}
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    id="username"
                    required
                    minLength={3}
                    maxLength={30}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>



                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    required
                    minLength={1}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    required
                    minLength={1}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="px-6 py-2 bg-clay text-white font-medium rounded-md hover:bg-clay/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={updateLoading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Membership Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 relative">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Membership</h2>
          <a
            href="/become-a-member"
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-clay transition-colors"
            aria-label="Edit membership"
          >
            <Edit size={20} />
          </a>
          
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
                  {formatBillingInterval(accountData.subscription.membershipLevel.isRecurring, accountData.subscription.membershipLevel.interval, accountData.subscription.membershipLevel.intervalCount)}
                </p>
                {!accountData.subscription.membershipLevel.isRecurring && (
                  <p className="text-xs text-gray-400 mt-1">
                    Lifetime access
                  </p>
                )}
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
                <p className="text-xs text-gray-400 mt-1">
                  Lifetime access
                </p>
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