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
    
    const fetchLevels = async () => {
      try {
        const response = await fetch('/api/membership-levels', {
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch membership levels');
        const data = await response.json();
        setLevels(data);
      } catch (err) {
        // Don't set error if the request was aborted (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('🔄 Membership levels fetch aborted - component unmounted');
          return;
        }
        
        setError('Failed to load membership levels');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
    
    // Cleanup function to abort the request if component unmounts
    return () => {
      abortController.abort();
    };
  }, []);

  return { levels, loading, error };
} 