interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateContactForm(data: ContactFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate name
  if (!data.name || !data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters long';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  // Validate email
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  } else if (data.email.length > 254) {
    errors.email = 'Email address is too long';
  }

  // Validate subject
  if (!data.subject || !data.subject.trim()) {
    errors.subject = 'Subject is required';
  } else if (data.subject.trim().length < 3) {
    errors.subject = 'Subject must be at least 3 characters long';
  } else if (data.subject.trim().length > 200) {
    errors.subject = 'Subject must be less than 200 characters';
  }

  // Validate message
  if (!data.message || !data.message.trim()) {
    errors.message = 'Message is required';
  } else if (data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters long';
  } else if (data.message.trim().length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
