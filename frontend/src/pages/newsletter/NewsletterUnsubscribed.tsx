import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function NewsletterUnsubscribed() {
  return (
    <div className="min-h-screen page-background py-12">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Successfully Unsubscribed
          </h1>
          
          <p className="text-gray-600 mb-8">
            You have been successfully unsubscribed from GAPI newsletters. You will no longer receive updates about events, news, and announcements.
          </p>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                What happens next?
              </h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• You won't receive any more GAPI newsletters</li>
                <li>• Your email has been removed from our mailing list</li>
                <li>• You can resubscribe anytime if you change your mind</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link
                to="/"
                className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Return to Homepage
              </Link>
              
              <Link
                to="/newsletter/unsubscribe"
                className="block w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Manage Newsletter Preferences
              </Link>
            </div>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-gray-500 text-sm mb-2">
                Changed your mind?
              </p>
              <Link
                to="/"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Resubscribe to GAPI newsletters
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
