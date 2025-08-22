// frontend/src/pages/Contact.tsx
import { useState } from 'react';
import { useRecaptcha } from '../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';
import { env } from '../config/environment';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export default function Contact() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  // Initialize reCAPTCHA hook
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({
    siteKey: RECAPTCHA_CONFIG.SITE_KEY,
    action: RECAPTCHA_CONFIG.ACTIONS.CONTACT_FORM
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Execute reCAPTCHA to get token
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        console.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }
      
      const response = await fetch(`${env.apiUrl}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setRecaptchaError(null); // Clear any previous reCAPTCHA errors
        
        // Reset success message after 5 seconds
        setTimeout(() => setSubmitStatus('idle'), 5000);
      } else {
        setSubmitStatus('error');
        console.error('Contact form submission failed:', result.message);
      }
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setSubmitStatus('error');
      
      // Check if it's a reCAPTCHA error
      if (error instanceof Error && error.message.includes('reCAPTCHA')) {
        setRecaptchaError('Security verification failed. Please refresh the page and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 min-h-screen relative overflow-hidden">
        {/* Background decorative elements */}
      <div aria-hidden className="absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-br from-red/20 via-red/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-brand-cream/40 via-brand-cream/20 to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/4 h-56 w-56 rounded-full bg-gradient-to-br from-blue/20 via-blue/10 to-transparent blur-2xl" />
        <div className="absolute top-1/4 right-1/4 h-40 w-40 rounded-full bg-gradient-to-br from-red/15 via-red/5 to-transparent blur-2xl" />
        <div className="absolute bottom-1/3 left-1/3 h-32 w-32 rounded-full bg-gradient-to-br from-blue/15 via-blue/5 to-transparent blur-xl" />
      </div>
    
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-12">
                     <div className="flex items-center justify-center gap-4 mb-6">
             <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red/20 via-red/10 to-red/5 rounded-full shadow-lg">
               <svg className="w-10 h-10 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
               </svg>
             </div>
             <h1 className="text-5xl font-bold bg-gradient-to-r from-neutral-dark via-red to-neutral-dark bg-clip-text text-transparent">
               Contact Us
             </h1>
           </div>
          <div className="w-24 h-1 bg-gradient-to-r from-red/40 via-red to-red/40 mx-auto mb-6 rounded-full"></div>
          <p className="text-xl text-neutral-dark/80 max-w-2xl mx-auto leading-relaxed">
            Get in touch with our team. We're here to help and answer your questions.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Contact Information */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-neutral-dark mb-6">Get in Touch</h2>
            
            <div className="bg-white rounded-lg shadow-lg border border-neutral-light p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red/20 to-red/10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-neutral-dark">Email</h3>
              </div>
              <p className="text-neutral-dark font-medium text-lg">info@gapi.org</p>
              <p className="text-sm text-neutral-dark/70 mt-1">We typically respond within 24-48 hours</p>
            </div>
            
                         <div className="bg-gradient-to-br from-blue/10 via-blue/5 to-blue/10 p-6 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-[1.01]">
               <h3 className="text-lg font-semibold text-neutral-dark mb-3">How We Can Help</h3>
               <p className="text-neutral-dark/80 leading-relaxed">
                 Have questions about GAPI, our mission, community, membership opportunities, 
                 or upcoming events and programs? We're here to help with all your inquiries.
               </p>
             </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-xl p-8 border border-neutral-light hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-neutral-dark mb-6">Send us a Message</h2>
            
            {submitStatus === 'success' && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  Thank you! Your message has been sent successfully. We'll get back to you soon.
                </p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  Sorry, there was an error sending your message. Please try again or email us directly at info@gapi.org
                </p>
              </div>
            )}

            {recaptchaError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  {recaptchaError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-neutral-dark mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${
                    errors.name ? 'border-red-300' : 'border-neutral-light'
                  }`}
                  placeholder="Enter your full name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-dark mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${
                    errors.email ? 'border-red-300' : 'border-neutral-light'
                  }`}
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-neutral-dark mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${
                    errors.subject ? 'border-red-300' : 'border-neutral-light'
                  }`}
                  placeholder="What is this regarding?"
                />
                {errors.subject && (
                  <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                )}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-neutral-dark mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  value={formData.message}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${
                    errors.message ? 'border-red-300' : 'border-neutral-light'
                  }`}
                  placeholder="Tell us how we can help you..."
                />
                {errors.message && (
                  <p className="mt-1 text-sm text-red-600">{errors.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                  isSubmitting
                    ? 'bg-neutral-light cursor-not-allowed'
                    : 'bg-red hover:bg-neutral-dark active:bg-red/80'
                }`}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 
