import { Star } from 'lucide-react';

interface CurrentPlanIndicatorProps {
  user: any;
  accountData?: any;
}

export default function CurrentPlanIndicator({ user, accountData }: CurrentPlanIndicatorProps) {
  // Use passed accountData if available, otherwise fallback to user data
  const membershipLevel = accountData?.subscription?.membershipLevel?.key || user?.membershipLevel;
  const subscriptionStatus = accountData?.subscription?.status;

  // Don't show if no membership level or subscription is not active
  if (!membershipLevel || (subscriptionStatus && subscriptionStatus !== 'ACTIVE')) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white text-gray-700 border-gray-200 text-sm font-medium shadow-sm">
      <Star className="w-4 h-4 text-yellow-500" />
      <span className="font-semibold">Current Plan: <span className="font-bold text-emerald-600">{membershipLevel.replace(/_/g, ' ')}</span></span>
    </div>
  );
} 
