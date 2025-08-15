// frontend/src/pages/Account.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager';
import { Edit, Trash2, AlertTriangle, UserIcon } from 'lucide-react';
import { validateUsername } from '../../utils/validation';
import { formatCurrency, formatDate, formatBillingInterval, formatMembershipLevelName, SUBSCRIPTION_STATUS } from '../../utils/formatters';
import { useAccountData } from '../../hooks/useAccountData';
import { env } from '../../config/environment';

interface AccountData {
  profile: {
    _id: string;
    email: string;
    username: string;
    name: {
      first: string;
      last: string;
    };
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    _id: string;
    status: string;
    kind: 'ONE_TIME' | 'RECURRING' | 'FREE';
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
    lastName: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Memoize sorted orders and latest order to avoid sorting on every render
  const { sortedOrders, latestOrder } = useMemo(() => {
    console.log('🔍 Payment history data:', {
      hasAccountData: !!accountData,
      hasPaymentHistory: !!accountData?.paymentHistory,
      orders: accountData?.paymentHistory?.orders,
      orderCount: accountData?.paymentHistory?.orders?.length || 0
    });
    
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
        lastName: accountData.profile.name.last
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

      const response = await fetch(`${env.apiUrl}/account/profile`, {
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
          }
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

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError(null);

    if (!deletePassword) {
      setDeleteError('Password is required');
      setDeleteLoading(false);
      return;
    }

    try {
      const token = TokenManager.getToken();
      if (!token) {
        setDeleteError('Please log in to delete your account');
        setDeleteLoading(false);
        return;
      }

      const response = await fetch(`${env.apiUrl}/account/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }

      // Account deleted successfully
      setShowDeleteModal(false);
      setDeletePassword('');
      
      // Logout and redirect
      TokenManager.logout();
      if (setUser) {
        setUser(null);
      }
      
      // Show a brief success message before redirecting
      alert('Account deactivated successfully. A confirmation email has been sent to your email address. You will be redirected to the home page.');
      window.location.href = '/home';
      
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="mt-2 text-gray-600">Manage your profile and account preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          </div>
          {!isEditing ? (
            <div className="px-6 py-4">
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserIcon className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {accountData.profile.name.first} {accountData.profile.name.last}
                  </h3>
                  <p className="text-gray-600">@{accountData.profile.username}</p>
                  <p className="text-gray-500">{accountData.profile.email}</p>
                  <p className="text-sm text-gray-400">
                    Member since {formatDate(accountData.profile.createdAt)}
                  </p>
                </div>
                <button
                  onClick={handleEditClick}
                  className="p-2 text-gray-400 hover:text-red transition-colors"
                  aria-label="Edit profile"
                >
                  <Edit size={20} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
                          <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200">
                  <span className="text-2xl font-bold text-blue-600">
                    {editForm.firstName[0]}{editForm.lastName[0]}
                  </span>
                </div>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Membership</h2>
          </div>
          <div className="px-6 py-4">
            {accountData.subscription ? (
              // Active subscription (recurring or lifetime membership)
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Plan: {formatMembershipLevelName(accountData.subscription.membershipLevel.key, accountData.subscription.membershipLevel.name)}
                </h3>
                {accountData.subscription.membershipLevel.description && (
                  <p className="text-gray-600 mb-4">
                    {accountData.subscription.membershipLevel.description}
                  </p>
                )}
                
                {/* Lifetime membership notice */}
                {accountData.subscription.kind === 'ONE_TIME' && (
                  <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center">
                      <span className="w-5 h-5 mr-2 flex items-center justify-center text-green-700 bg-green-100 rounded-full text-sm">✓</span>
                      <span className="font-medium text-green-800">Lifetime Membership</span>
                    </div>
                    <p className="text-green-700 text-sm mt-1 ml-7">
                      Your membership is active and will not expire. No recurring payments required.
                    </p>
                  </div>
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
                  {accountData.subscription.nextBillDate && accountData.subscription.kind !== 'ONE_TIME' && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Next billing:</span> {formatDate(accountData.subscription.nextBillDate)}
                    </p>
                  )}
                  {accountData.subscription.cancelDate && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Cancelled:</span> {formatDate(accountData.subscription.cancelDate)}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Price:</span> {formatCurrency(accountData.subscription.membershipLevel.unitAmount, accountData.subscription.membershipLevel.currency)}
                    {accountData.subscription.membershipLevel.isRecurring && accountData.subscription.kind !== 'ONE_TIME' && (
                      <span> {formatBillingInterval(accountData.subscription.membershipLevel.isRecurring, accountData.subscription.membershipLevel.interval, accountData.subscription.membershipLevel.intervalCount)}</span>
                    )}
                    {accountData.subscription.kind === 'ONE_TIME' && (
                      <span> (one-time payment)</span>
                    )}
                  </p>
                </div>
              </div>
            ) : accountData.paymentHistory.orders.length > 0 ? (
              // No active subscription but has payment history (lifetime membership)
              latestOrder && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Plan: {formatMembershipLevelName(latestOrder.membershipLevel.key, latestOrder.membershipLevel.name)}
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
                      <span className="font-medium">Purchased:</span> {formatDate(latestOrder.paidAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Price:</span> {formatCurrency(latestOrder.totalCents, latestOrder.currency)} (one-time payment)
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

        {/* Payment History Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
            {accountData.paymentHistory.orders.length > 0 && (
              <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="font-medium">Total Orders:</span>
                  <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-semibold">
                    {accountData.paymentHistory.orderCount}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">Total Spent:</span>
                  <span className="bg-green-100 px-2 py-1 rounded-full text-xs font-semibold text-green-800">
                    {formatCurrency(accountData.paymentHistory.totalSpent, 'usd')}
                  </span>
                </span>
              </div>
            )}
          </div>
          {sortedOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedOrders.map((order) => (
                    <tr key={order._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order._id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatMembershipLevelName(order.membershipLevel.key, order.membershipLevel.name)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.totalCents, order.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'paid' || order.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone - Delete Account */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </h2>
            <p className="mt-1 text-sm text-red-700">
              Once you delete your account, there is no going back. Please be certain.
            </p>
          </div>
          
          <div className="px-6 py-4">
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-2">Delete Account</h3>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete your account and all associated data. This will also cancel your membership and stop any recurring payments.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </button>
            </div>
          </div>
        </div>

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">
                  Delete Account
                </h3>
                <div className="mt-2 px-7">
                  <p className="text-sm text-gray-500 text-center">
                    This action cannot be undone. This will permanently delete your account, cancel your membership, stop any recurring payments, and remove all your data from our servers.
                  </p>
                </div>
                
                <form onSubmit={handleDeleteAccount} className="mt-4">
                  <div>
                    <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700">
                      Confirm your password
                    </label>
                    <input
                      type="password"
                      id="deletePassword"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  
                  {deleteError && (
                    <div className="mt-3 text-sm text-red-600 text-center">
                      {deleteError}
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeletePassword('');
                        setDeleteError(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deleteLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
