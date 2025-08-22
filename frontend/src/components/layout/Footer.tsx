import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Mail, X, FacebookIcon } from 'lucide-react';
import gapiLogo from '../../assets/gapi_logo.png';

export default function Footer() {
  const year = new Date().getFullYear();
  const location = useLocation();
  
  // Determine background color based on current route
  const getLogoBackgroundColor = () => {
    // Pages to set cream footer background
    const creamPages = [
      '/events',
      '/news'
    ]
      
    if (creamPages.includes(location.pathname)) {
      return 'bg-brand-cream';
    }

    return 'bg-gray-50'; // Default gray-50 background for all other pages
  };
  
  return (
    <div className={`relative ${getLogoBackgroundColor()}`}>
      {/* Logo Overlay */}
      <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-88 lg:h-88 xl:w-96 xl:h-96 pointer-events-none mt-16">
        <img 
          src={gapiLogo} 
          alt="GAPI Logo" 
          className="w-full h-full object-contain"
        />
      </div>
      
      <footer className="bg-white text-neutral-dark py-16 border-t border-neutral-light relative z-10 mt-16">
      
      <div className="w-full px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-16 lg:gap-20 mb-16">
          {/* Left Column - Contact Info */}
          <div className="md:col-span-1">
            <div className="space-y-10">
              {/* Contact Info */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-neutral-dark">Contact Us</h4>
                <div className="space-y-5 text-neutral-dark/70">
                  <div className="flex items-start space-x-4">
                    <div className="w-6 h-6 bg-red/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3 h-3 text-red" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-dark">106 Erin Lee Court</p>
                      <p className="text-sm text-neutral-dark/60">Warner Robins, GA 31008</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-6 h-6 bg-red/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3 h-3 text-red" />
                    </div>
                    <a 
                      href="mailto:info@gapi.org" 
                      className="font-medium text-neutral-dark hover:text-red transition-colors duration-200"
                    >
                      info@gapi.org
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-neutral-dark">Follow Us</h4>
                <div className="flex items-center space-x-5">
                  <a 
                    href="https://x.com/gapigeorgia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-neutral-dark/5 rounded-full flex items-center justify-center text-neutral-dark/50 hover:bg-red hover:text-white transition-colors duration-200"
                    aria-label="Follow us on X (Twitter)"
                  >
                    <X size={16} />
                  </a>
                  <a 
                    href="https://www.facebook.com/profile.php?id=100064418690446&ref=br_rs#" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-neutral-dark/5 rounded-full flex items-center justify-center text-neutral-dark/50 hover:bg-red hover:text-white transition-colors duration-200"
                    aria-label="Follow us on Facebook"
                  >
                    <FacebookIcon size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <h4 className="text-lg font-semibold mb-6 text-neutral-dark">Quick Links</h4>
            <ul className="space-y-4">
              <li>
                <Link to="/home" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/clinic" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Clinic
                </Link>
              </li>
              <li>
                <Link to="/news" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  News
                </Link>
              </li>
              <li>
                <Link to="/become-a-member" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Become a Member
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Terms */}
          <div className="md:col-span-1">
            <h4 className="text-lg font-semibold mb-6 text-neutral-dark">Terms</h4>
            <ul className="space-y-4">
              <li>
                <Link to="/privacy-policy" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-conditions" className="text-neutral-dark/70 hover:text-red transition-colors duration-200 font-medium">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
            
            {/* reCAPTCHA Privacy Notice */}
            <div className="mt-8 pt-6 border-t border-neutral-light/50">
              <p className="text-xs text-neutral-dark/50 leading-relaxed">
                This website uses Google reCAPTCHA v3 for security. By using this site, you agree to Google's{' '}
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neutral-dark/60 hover:text-red underline transition-colors"
                >
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a 
                  href="https://policies.google.com/terms" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neutral-dark/60 hover:text-red underline transition-colors"
                >
                  Terms of Service
                </a>.
              </p>
            </div>
          </div>

          {/* Google Map */}
          <div className="md:col-span-2">
            <h4 className="text-lg font-semibold mb-6 text-neutral-dark">Our Location</h4>
            <div className="w-full">
              <div className="w-full h-64 rounded overflow-hidden shadow-sm border border-neutral-light/50">
                <iframe
                  title="GAPI Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.1234567890123!2d-83.61234567890123!3d32.61234567890123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13!1!3m3!1m2!1s0x88f1234567890123%3A0x1234567890123456!2s106%20Erin%20Lee%20Ct%2C%20Warner%20Robins%2C%20GA%2031008!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                ></iframe>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-12 border-t border-neutral-light/50">
          <div className="text-center">
            <p className="text-neutral-dark/60 text-sm">
              © {year} GAPI. | GAPI.ORG | All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
      </footer>
    </div>
  );
} 
