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
    const fetchLevels = async () => {
      try {
        const response = await fetch('/api/membership-levels');
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

    fetchLevels();
  }, []);

  return { levels, loading, error };
} 