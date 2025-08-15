import { Star } from 'lucide-react';

interface CurrentPlanIndicatorProps {
  user: any;
  accountData?: any;
}

export default function CurrentPlanIndicator({ user, accountData }: CurrentPlanIndicatorProps) {
  // Use passed accountData if available, otherwise fallback to user data
  const membershipLevel = accountData?.subscription?.membershipLevel?.key || user?.membershipLevel;
  const subscriptionStatus = accountData?.subscription?.status;
  const subscriptionKind = accountData?.subscription?.kind;

  // Don't show if no membership level or subscription is not active
  if (!membershipLevel || (subscriptionStatus && subscriptionStatus !== 'ACTIVE')) {
    return null;
  }

  const isLifetime = subscriptionKind === 'ONE_TIME';

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium shadow-sm ${
      isLifetime 
        ? 'bg-green-50 text-green-700 border-green-200' 
        : 'bg-white text-gray-700 border-gray-200'
    }`}>
      <Star className={`w-4 h-4 ${isLifetime ? 'text-green-600' : 'text-yellow-500'}`} />
      <span className="font-semibold">
        Current Plan: <span className="font-bold text-emerald-600">{membershipLevel.replace(/_/g, ' ')}</span>
        {isLifetime && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Lifetime</span>}
      </span>
    </div>
  );
} 
