import { useState, useEffect } from 'react';

interface MembershipLevel {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isRecurring: boolean;
}

export function useMembershipLevels() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch(`${API_URL}/api/membership-levels`);
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
  }, [API_URL]);

  return { levels, loading, error };
} 