// frontend/src/pages/Account.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TokenManager from '../../utils/tokenManager';
import { Edit, Trash2, AlertTriangle, UserIcon } from 'lucide-react';
import PasswordChange from '../../components/auth/PasswordChange';
import { validateUsername } from '../../utils/validation';
import { formatCurrency, formatDate, formatBillingInterval, formatMembershipLevelName, SUBSCRIPTION_STATUS } from '../../utils/formatters';
import { useAccountData } from '../../hooks/useAccountData';
import { env } from '../../config/environment';



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
    const [isFadingOut, setIsFadingOut] = useState(false);
  
  // Billing refresh state
    const [billingRefreshSuccess, setBillingRefreshSuccess] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check if user is returning from Stripe portal and refresh data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromStripe = urlParams.get('fromStripe');
    
    if (fromStripe === 'true') {
      console.log('🔄 User returned from Stripe portal, refreshing account data...');
      // Use an async function to handle the refetch
      const refreshData = async () => {
        await refetchAccountData();
      };
      refreshData();
      
      // Clean up the URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [refetchAccountData]);

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
    setIsFadingOut(false);

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
      setUpdateSuccess('Profile saved!');
      setIsEditing(false);
      
      // Update the user in TokenManager and localStorage
      TokenManager.setUser(data.profile);
      
      // Update the App state if setUser is provided
      if (setUser) {
        setUser(data.profile);
      }
      
      // Refresh account data to update the Membership box and other components
      await refetchAccountData();
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setUpdateSuccess(null);
          setIsFadingOut(false);
        }, 300);
      }, 5000);
    
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

      const response = await fetch(`${env.apiUrl}/account`, {
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
    <div className="min-h-screen page-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="mt-2 text-gray-600">Manage your profile and account preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
            
            {/* Profile update success message */}
            {updateSuccess && !isEditing && (
              <div className={`rounded-lg border border-green-200 bg-green-50 px-3 py-2 transform transition-all duration-300 ease-in-out ${
                isFadingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}>
                <div className="flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center text-green-700 bg-green-100 rounded-full text-xs font-bold">✓</span>
                  <span className="text-sm font-medium text-green-800">{updateSuccess}</span>
                </div>
              </div>
            )}
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
                  <div className="mb-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {accountData.profile.name.first} {accountData.profile.name.last}
                    </h3>
                  </div>
                  <p className="text-gray-600">@{accountData.profile.username}</p>
                  <p className="text-gray-500">{accountData.profile.email}</p>
                  <p className="text-sm text-gray-400">
                    Member since {formatDate(accountData.profile.createdAt)}
                  </p>
                </div>
                <button
                  onClick={handleEditClick}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Edit profile"
                >
                  <Edit size={20} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-6 px-6 py-4">
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
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 transform transition-all duration-300 ease-in-out animate-in fade-in">
                      <div className="flex items-center">
                        <span className="w-5 h-5 mr-3 flex items-center justify-center text-green-700 bg-green-100 rounded-full text-sm font-bold">✓</span>
                        <span className="font-medium text-green-800">{updateSuccess}</span>
                      </div>
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
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Membership</h2>

            <button
              onClick={async () => {
                if (isRefreshing) return;
                setBillingRefreshSuccess(null);
                setIsRefreshing(true);
                const result = await refetchAccountData({ silent: true });
                if (result.ok) {
                  setBillingRefreshSuccess('Billing information refreshed successfully!');
                } else if (!result.aborted) {
                  setBillingRefreshSuccess(result.error || 'Could not refresh billing info. Please try again.');
                }
                setTimeout(() => {
                  setBillingRefreshSuccess(null);
                  setIsRefreshing(false);
                }, 2200);
              }}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              aria-live="polite"
              title={isRefreshing ? 'Refreshing…' : 'Refresh billing information'}
              className="p-3 text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg 
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"

              >
                
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="sr-only">{isRefreshing ? 'Refreshing billing' : 'Refresh billing'}</span>
            </button>
          </div>
          <div className="px-6 py-4">
            {/* Billing refresh success message */}
            {billingRefreshSuccess && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 transform transition-all duration-300 ease-in-out animate-in fade-in">
                <div className="flex items-center">
                  <span className="w-4 h-4 mr-2 flex items-center justify-center text-green-600 bg-green-100 rounded-full text-xs">✓</span>
                  <span className="text-sm text-green-700">{billingRefreshSuccess}</span>
                </div>
              </div>
            )}
            
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

        {/* Password Section */}
        <PasswordChange
          className="mb-8"
        />

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
                Permanently delete your account and all associated data. This will also cancel your membership at the end of your current billing period.
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
                    This action cannot be undone. This will permanently delete your account, cancel your membership at the end of your current billing period, and remove all your data from our servers.
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
