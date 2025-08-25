export interface RegistrationFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  agree: boolean;
  profilePic?: File;
}

export interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  publicUrl?: string | null;
}

export interface NewsletterCampaignList {
  campaigns: NewsletterCampaign[];
  total: number;
  page: number;
  limit: number;
} 
