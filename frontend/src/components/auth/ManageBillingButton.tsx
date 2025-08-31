// frontend/src/components/auth/ManageBillingButton.tsx
import { useState, useEffect } from 'react';
import TokenManager from '../../utils/tokenManager';
import { env } from '../../config/environment';

interface ManageBillingButtonProps {
  accountData?: any;
}

export default function ManageBillingButton({ accountData }: ManageBillingButtonProps) {
  const [isLifetime, setIsLifetime] = useState(false);
  const [buttonLabel, setButtonLabel] = useState('Manage Subscription');

  useEffect(() => {
    const sub = accountData?.subscription;
    setIsLifetime(sub?.kind === 'ONE_TIME');
    setButtonLabel(sub?.stripeStatus === 'trialing' ? 'Add/Update Card' : 'Manage Subscription');
  }, [accountData?.subscription]);

  const openPortal = async () => {
    const token = TokenManager.getToken();
    if (!token) return (window.location.href = '/auth/login');

    const r = await fetch(`${env.apiUrl}/billing/portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      console.error('Portal session failed');
      return;
    }
    const { url } = await r.json();
    window.location.href = url;
  };

  // Don't show billing portal button for lifetime members
  if (isLifetime) {
    return null;
  }

  return (
    <button onClick={openPortal} className="btn btn-primary">
      {buttonLabel}
    </button>
  );
}
