// frontend/src/hooks/useAccountData.ts
import { useState, useEffect } from 'react';
import TokenManager from '../utils/tokenManager';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

export interface AccountData {
  profile: {
    _id: string;
    email: string;
    username: string;
    name: { first: string; last: string };
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    _id: string;
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
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
}

type FetchResult = { ok: boolean; aborted?: boolean; error?: string };
type FetchOpts = { signal?: AbortSignal; silent?: boolean };

export function useAccountData() {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = async (opts: FetchOpts = {}): Promise<FetchResult> => {
    const { signal, silent = false } = opts;
    
    // Only update loading and error state if not silent
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const token = TokenManager.getToken();
      if (!token) {
        const msg = 'Authentication required. Please log in again.';
        if (!silent) {
          setError(msg);
          setLoading(false);
        }
        return { ok: false, error: msg };
      }

      const response = await fetch(`${env.apiUrl}/account/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal,
      });

      if (response.ok) {
        const data = await response.json();
        setAccountData(data);
        logger.info('✅ Account data fetched:', {
          userId: data._id,
          email: data.email,
          username: data.username,
          membershipLevel: data.subscription?.membershipLevel?.key,
          subscriptionStatus: data.subscription?.status
        });
        return { ok: true };
      } else {
        logger.error(`Failed to fetch account data: ${response.status} ${response.statusText}`);
        let msg = 'Failed to load account information. Please try again.';
        
        if (response.status === 401) {
          TokenManager.removeToken();
          logger.info('🔄 Cleared invalid token');
          msg = 'Your session has expired. Please log in again.';
        } else if (response.status === 403) {
          TokenManager.removeToken();
          logger.info('🔄 Account deactivated, clearing token');
          msg = 'Your account has been deactivated. Please contact support if you believe this is an error.';
        }
        
        // Only update error state if not silent
        if (!silent) {
          setError(msg);
          setAccountData(null);
        }
        return { ok: false, error: msg };
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        logger.info('🔄 Account data fetch aborted - component unmounted');
        return { ok: false, aborted: true };
      }
      
      logger.error('Error fetching account data:', e);
      const msg = 'Unable to connect to the server. Please check your internet connection.';
      
      // Only update error state if not silent
      if (!silent) {
        setError(msg);
        setAccountData(null);
      }
      return { ok: false, error: msg };
    } finally {
      // Only update loading state if not silent
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    fetchAccountData({ signal: abortController.signal, silent: false });
    return () => abortController.abort();
  }, []);

  // Enhanced refetch function that supports silent operation
  const refetch = async (opts?: { silent?: boolean }): Promise<FetchResult> => {
    return fetchAccountData({ silent: !!opts?.silent });
  };

  return { accountData, loading, error, refetch };
} 
