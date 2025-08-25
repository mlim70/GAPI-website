//frontend/src/types/index.ts
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
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  canEmbed?: boolean;
  absoluteViewUrl: string;
  previewImageUrl?: string | null;
  previewSnippet?: string | null;
} 
