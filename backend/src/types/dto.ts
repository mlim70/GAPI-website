// backend/src/types/dto.ts
export interface UserProfileDto {
  _id: string;
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MembershipLevelDto {
  _id: string;
  key: string;
  name: string;
  description?: string;
  unitAmount: number;
  currency: string;
  isRecurring: boolean;
  interval?: string;
  intervalCount?: number;
}

export interface SubscriptionDto {
  _id: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  kind: 'ONE_TIME' | 'RECURRING' | 'FREE';
  startDate: Date;
  nextBillDate?: Date;
  cancelDate?: Date;
  membershipLevel: MembershipLevelDto;
}

export interface AccountDataDto {
  profile: UserProfileDto;
  subscription: SubscriptionDto | null;
}
