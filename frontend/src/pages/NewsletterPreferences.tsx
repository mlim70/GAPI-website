import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { env } from '../config/environment';

export default function NewsletterPreferences() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${env.apiUrl}/newsletter/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        setMessage('You have been successfully unsubscribed from the newsletter.');
        setMessageType('success');
        setEmail('');
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Failed to unsubscribe. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Newsletter Preferences
            </h1>
            <p className="text-gray-600">
              Manage your GAPI newsletter subscription
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

          <div className="space-y-6">
            {/* Unsubscribe Section */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Unsubscribe from Newsletter
              </h2>
              <p className="text-gray-600 mb-4">
                Enter your email address below to unsubscribe from the GAPI newsletter.
              </p>
              
              <form onSubmit={handleUnsubscribe} className="space-y-4">
                <div>
                  <label htmlFor="unsubscribe-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="unsubscribe-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
              </form>
            </div>

            {/* Information Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-3">
                About GAPI Newsletters
              </h3>
              <ul className="text-blue-800 space-y-2 text-sm">
                <li>• Monthly updates on GAPI events and activities</li>
                <li>• Important announcements and news</li>
                <li>• Professional development opportunities</li>
                <li>• Community highlights and achievements</li>
              </ul>
            </div>

            {/* Contact Section */}
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Have questions about your newsletter subscription?
              </p>
              <Link
                to="/contact"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Contact GAPI Support
              </Link>
            </div>

            {/* Back to Home */}
            <div className="text-center pt-4 border-t border-gray-200">
              <Link to="/home" className="text-red hover:text-red/80 underline">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
