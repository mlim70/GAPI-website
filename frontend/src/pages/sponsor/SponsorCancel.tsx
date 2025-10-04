// frontend/src/pages/sponsor/SponsorCancel.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function SponsorCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-neutral-dark mb-4">Sponsorship Cancelled</h1>
        <p className="text-neutral-dark/80 mb-6">
          Your sponsorship payment was cancelled. No charges have been made to your account.
        </p>
        <p className="text-sm text-neutral-dark/60 mb-6">
          If you'd like to try again or have questions about sponsoring GAPI, we're here to help.
        </p>
        <div className="space-y-3">
          <Link
            to="/sponsor-us"
            className="block w-full bg-red text-white py-3 px-6 rounded-lg font-semibold hover:bg-red/90 transition-colors"
          >
            Try Again
          </Link>
          <Link
            to="/contact?subject=Sponsorship Question"
            className="block w-full bg-neutral-light text-neutral-dark py-3 px-6 rounded-lg font-semibold hover:bg-neutral-light/80 transition-colors"
          >
            Contact Us
          </Link>
          <Link
            to="/"
            className="block w-full text-neutral-dark/60 py-2 hover:text-neutral-dark transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
