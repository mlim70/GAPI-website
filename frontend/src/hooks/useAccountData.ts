// frontend/src/hooks/useAccountData.ts
import { useState, useEffect } from 'react';
import TokenManager from '../utils/tokenManager.js';
import { env } from '../config/environment';

export interface AccountData {
  profile: {
    _id: string;
    email: string;
    username: string;
    name: {
      first: string;
      last: string;
    };
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

export function useAccountData() {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = async (abortController?: AbortController) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = TokenManager.getToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${env.apiUrl}/account/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: abortController?.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setAccountData(data);
        console.log('✅ Account data fetched:', { 
          membershipLevel: data.subscription?.levelId?.key,
          subscriptionStatus: data.subscription?.status
        });
      } else {
        console.error('Failed to fetch account data:', response.status, response.statusText);
        if (response.status === 401) {
          TokenManager.removeToken();
          console.log('🔄 Cleared invalid token');
          setError('Your session has expired. Please log in again.');
        } else if (response.status === 403) {
          TokenManager.removeToken();
          console.log('🔄 Account deactivated, clearing token');
          setError('Your account has been deactivated. Please contact support if you believe this is an error.');
        } else {
          setError('Failed to load account information. Please try again.');
        }
        setAccountData(null);
      }
    } catch (error) {
      // Don't set error if the request was aborted (component unmounted)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🔄 Account data fetch aborted - component unmounted');
        return;
      }
      
      console.error('Error fetching account data:', error);
      setError('Unable to connect to the server. Please check your internet connection.');
      setAccountData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchAccountData(abortController);
    
    // Cleanup function to abort the request if component unmounts
    return () => {
      abortController.abort();
    };
  }, []);

  const refetch = () => {
    // Create a new AbortController for manual refetch
    const abortController = new AbortController();
    fetchAccountData(abortController);
    return abortController; // Return the controller in case caller wants to abort
  };

  return {
    accountData,
    loading,
    error,
    refetch,
  };
} 
