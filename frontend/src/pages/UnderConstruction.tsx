import React from 'react';
import { HardHat } from 'lucide-react';

const UnderConstruction: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FBFBF0] relative flex items-center justify-center px-4 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-15">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d33b41' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}></div>
      </div>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-50/40 to-red-100/60 opacity-60"></div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-r from-red-600 to-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <HardHat className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Main Content */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-theme mb-6">
          Under Construction
        </h1>
        
        <p className="text-xl text-neutral-dark mb-8 leading-relaxed">
          We're working hard to bring you something amazing! Our website is currently being updated with new features and improvements.
        </p>

        {/* Status Information */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-8 border border-neutral-light">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-gold rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-theme">Maintenance in Progress</span>
          </div>
          <p className="text-neutral-dark text-sm">
            Expected completion: 1-2 Days
          </p>
        </div>

        {/* Contact Information */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-neutral-light">
          <h3 className="text-lg font-semibold text-gray-theme mb-3">
            Need to reach us?
          </h3>
          <p className="text-neutral-dark mb-4">
            If you have urgent business inquiries, please contact us directly.
          </p>
          <div className="space-y-2 text-sm text-neutral-dark">
            <p className="flex items-center justify-center space-x-2">
              <span className="text-red-600">📧</span>
              <span>Email: <a href="mailto:info@gapi.org" className="text-red-600 hover:text-red-700 underline">info@gapi.org</a></span>
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-sm text-neutral-dark">
          <p>Thank you for your patience and understanding.</p>
          <p className="mt-1">We appreciate your continued support!</p>
        </div>

        {/* Decorative accent */}
        <div className="mt-12 opacity-20">
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default UnderConstruction;
