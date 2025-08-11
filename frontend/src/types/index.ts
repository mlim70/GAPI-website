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
