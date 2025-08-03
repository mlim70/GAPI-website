// frontend/src/pages/Account.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager.js';
import { Edit } from 'lucide-react';
import { validateUsername } from '../../utils/validation.js';
import { formatCurrency, formatDate, formatBillingInterval, formatMembershipLevelName, SUBSCRIPTION_STATUS } from '../../utils/formatters.js';
import { useAccountData } from '../../hooks/useAccountData.js';

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
  const { accountData, loading, error, refetch: refetchAccountData } = useAccountData();
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

  // Memoize sorted orders and latest order to avoid sorting on every render
  const { sortedOrders, latestOrder } = useMemo(() => {
    if (!accountData?.paymentHistory?.orders) {
      return { sortedOrders: [], latestOrder: null };
    }
    
    const sorted = [...accountData.paymentHistory.orders].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );
    
    return {
      sortedOrders: sorted,
      latestOrder: sorted[0] || null
    };
  }, [accountData?.paymentHistory?.orders]);


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

      const response = await fetch('/api/account/avatar', {
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

    // Validate and normalize username before submitting
    const usernameValidation = validateUsername(editForm.username);
    if (!usernameValidation.isValid) {
      setUpdateError(usernameValidation.error || 'Invalid username');
      setUpdateLoading(false);
      return;
    }

    try {
      const token = TokenManager.getToken();
      if (!token) {
        setUpdateError('Please log in to update your profile');
        setUpdateLoading(false);
        return;
      }

      const response = await fetch('/api/account/profile', {
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
      setUpdateSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Update the user in TokenManager and localStorage
      TokenManager.setUser(data.profile);
      
      // Update the App state if setUser is provided
      if (setUser) {
        setUser(data.profile);
      }
      
      // Refetch account data to get the latest information
      refetchAccountData();
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setUpdateError(err.message || 'Failed to update profile');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
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
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No account data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 bg-gray-50">
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
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red transition-colors"
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
                        className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 group-hover:border-red transition-all duration-200 group-hover:brightness-75"
                        src={editForm.avatarUrl}
                        alt="Profile"
                      />
                      <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Edit className="text-white w-6 h-6 drop-shadow-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200 group-hover:border-red transition-colors cursor-pointer relative">
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent ${
                      editForm.username && !validateUsername(editForm.username).isValid
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="e.g., john_doe123"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Letters, numbers, hyphens, and underscores only. Must start with a letter or number. 3-30 characters.
                  </p>
                  {editForm.username && !validateUsername(editForm.username).isValid && (
                    <p className="text-xs text-red-500 mt-1">
                      {validateUsername(editForm.username).error}
                    </p>
                  )}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="px-6 py-2 bg-red text-white font-medium rounded-md hover:bg-red/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={updateLoading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          <Link
            to="/become-a-member"
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red transition-colors"
            aria-label="Edit membership"
          >
            <Edit size={20} />
          </Link>
          
          {accountData.subscription ? (
            // Active subscription (recurring membership)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Plan: <span className="text-green-600 font-bold text-xl">{formatMembershipLevelName(accountData.subscription.membershipLevel.key, accountData.subscription.membershipLevel.name)}</span>
                </h3>
                {accountData.subscription.membershipLevel.description && (
                  <p className="text-gray-600 mb-4">
                    Description: {accountData.subscription.membershipLevel.description}
                  </p>
                )}
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      accountData.subscription.status === SUBSCRIPTION_STATUS.ACTIVE 
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
            latestOrder && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Plan: <span className="text-green-600 font-bold text-xl">{formatMembershipLevelName(latestOrder.membershipLevel.key, latestOrder.membershipLevel.name)}</span>
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Description: Lifetime membership - no recurring payments
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Status:</span>{' '}
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ACTIVE
                        </span>
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Purchased:</span> {formatDate(latestOrder.paidAt)}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Type:</span> Lifetime Membership
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(latestOrder.totalCents, latestOrder.currency)}
                    </p>
                    <p className="text-gray-500">one-time payment</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Lifetime access
                    </p>
                  </div>
                </div>
              )
          ) : (
            // No membership found
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No active membership found</p>
              <Link 
                to="/become-a-member" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red hover:bg-red/90"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
