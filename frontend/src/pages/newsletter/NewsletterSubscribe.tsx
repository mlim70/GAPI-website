//frontend/src/pages/NewsletterSubscribe.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { env } from '../../config/environment';
import { Mail } from 'lucide-react';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { logger } from '../../utils/logger';

export default function NewsletterSubscribe() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  // Initialize reCAPTCHA hook
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({
    siteKey: RECAPTCHA_CONFIG.SITE_KEY,
    action: RECAPTCHA_CONFIG.ACTIONS.NEWSLETTER_SUBSCRIBE
  });

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setRecaptchaError(null);

    try {
      // Execute reCAPTCHA to get token
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        logger.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      const response = await fetch(`${env.apiUrl}/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(),
          recaptchaToken
        }),
      });

      if (response.ok) {
        setMessage('Thank you! You have been successfully subscribed to the GAPI newsletter.');
        setMessageType('success');
        setEmail('');
        setRecaptchaError(null);
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Failed to subscribe. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      logger.error('Error subscribing to newsletter:', error);
      
      // Check if it's a reCAPTCHA error
      if (error instanceof Error && error.message.includes('reCAPTCHA')) {
        setRecaptchaError('Security verification failed. Please refresh the page and try again.');
        setMessage('Security verification failed. Please try again.');
      } else {
        setMessage('An error occurred. Please try again.');
      }
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 bg-gray-50">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 text-red-500 mb-4">
              <Mail className="w-full h-full" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Subscribe to GAPI Newsletter
            </h1>
            <p className="text-gray-600">
              Stay updated with the latest news, events, and announcements from the Georgia Association of Physicians of Indian Heritage.
            </p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              messageType === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {recaptchaError && (
            <div className="mb-6 p-4 rounded-md bg-red-50 text-red-800 border border-red-200">
              {recaptchaError}
            </div>
          )}

          <div className="space-y-6">
            {/* Subscribe Section */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Subscribe to Newsletter
              </h2>
              <p className="text-gray-600 mb-4">
                Enter your email address below to receive the GAPI newsletter.
              </p>
              
              <form onSubmit={handleSubscribe} className="space-y-4">
                <div>
                  <label htmlFor="subscribe-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="subscribe-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Subscribing...' : 'Subscribe to Newsletter'}
                </button>
              </form>
            </div>

            {/* Additional Info */}
            <div className="text-center text-sm text-gray-500">
              <p className="mb-2">
                By subscribing, you agree to receive email updates from GAPI.
              </p>
              <p>
                Need to unsubscribe later?{' '}
                <Link to="/newsletter/unsubscribe" className="text-red-600 hover:text-red-700 underline">
                  Unsubscribe here
                </Link>
              </p>
            </div>

            {/* Back to Newsletter */}
            <div className="text-center">
              <Link 
                to="/newsletter" 
                className="text-red-600 hover:text-red-700 font-medium"
              >
                ← Back to Newsletter Archive
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
