//frontend/src/types/index.ts
export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  levelKey: string;
  recaptchaToken: string;
}

export interface RegistrationFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  agree: boolean;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  recaptcha: {
    score: number;
    action: string;
    success: boolean;
  };
}

export interface LoginResponse {
  token: string;
  user: any;
  subscription?: {
    _id: string;
    status: string;
    kind: string;
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
  };
}

export interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  canEmbed?: boolean;
  absoluteViewUrl: string;
  previewImageUrl?: string | null;
  previewSnippet?: string | null;
} 
