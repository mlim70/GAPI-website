import { useState, useEffect } from 'react';

interface MembershipLevel {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isRecurring: boolean;
  unitAmount: number;
  currency: string;
  interval?: string;
  intervalCount?: number;
}

export function useMembershipLevels() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();
    let retryCount = 0;
    const maxRetries = 2;
    
    const checkHealth = async (): Promise<boolean> => {
      try {
        const response = await fetch('/api/health', { 
          signal: abortController.signal
        });
        return response.ok;
      } catch (err) {
        return false;
      }
    };
    
    const fetchLevels = async () => {
      try {
        // Simple health check before fetching
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          throw new Error('Backend not ready');
        }
        
        const response = await fetch('/api/membership-levels', {
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setLevels(data);
        setError('');
        setLoading(false);
      } catch (err) {
        // Don't set error if the request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        // Simple retry logic for network errors
        if (retryCount < maxRetries && err instanceof Error) {
          retryCount++;
          setTimeout(() => {
            if (!abortController.signal.aborted) {
              fetchLevels();
            }
          }, 1000);
          return;
        }
        
        setError('Failed to load membership levels');
        setLoading(false);
      }
    };

    // Start fetching immediately
    fetchLevels();

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, []);

  return { levels, loading, error };
} 
