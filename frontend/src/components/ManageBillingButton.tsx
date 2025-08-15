import TokenManager from '../utils/tokenManager';
import { env } from '../config/environment';

export default function ManageBillingButton() {
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

  return (
    <button onClick={openPortal} className="btn btn-primary">
      Manage billing
    </button;
  );
}
