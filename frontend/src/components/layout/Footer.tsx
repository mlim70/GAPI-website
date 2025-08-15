import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Mail, X, FacebookIcon } from 'lucide-react';
import gapiLogo from '../../assets/gapi_logo.png';

export default function Footer() {
  const year = new Date().getFullYear();
  const location = useLocation();
  
  // Determine background color based on current route
  const getLogoBackgroundColor = () => {
    if (location.pathname === '/events' || location.pathname === '/news') {
      return 'bg-brand-cream'; // Match Events and News page backgrounds
    }
    if (location.pathname === '/become-a-member') {
      return 'bg-gray-50'; // Match Become a Member page background
    }
    return 'bg-white'; // Default background for other pages
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
      
      <footer className="bg-white text-neutral-dark py-8 border-t border-neutral-light relative z-10 mt-16">
      
      <div className="container mx-auto my-10 grid grid-cols-1 md:grid-cols-5 gap-16 px-6 sm:px-8 lg:px-16 max-w-7xl">
          {/* Left Column - Contact Info */}
          <div className="md:pl-0">
            <div className="grid grid-cols-1 gap-6">
              {/* Contact Info */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-neutral-dark">Contact Us</h4>
                <div className="space-y-2 text-neutral-dark/70">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-neutral-dark/60" />
                    <div>
                      <p className="font-medium">106 Erin Lee Court</p>
                      <p className="font-medium">Warner Robins, GA 31008</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 flex-shrink-0 text-neutral-dark/60" />
                    <a 
                      href="mailto:info@gapi.org" 
                      className="underline hover:text-neutral-dark transition-colors font-medium"
                    >
                      info@gapi.org
                    </a>
                  </div>

                </div>
              </div>

              {/* Social Media */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-neutral-dark">Follow Us</h4>
                <div className="flex items-center space-x-4">
                  <a 
                    href="https://x.com/gapigeorgia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-neutral-dark/60 hover:text-neutral-dark transition-colors"
                    aria-label="Follow us on X (Twitter)"
                  >
                    <X size={24} />
                  </a>
                  <a 
                    href="https://www.facebook.com/profile.php?id=100064418690446&ref=br_rs#" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-neutral-dark/60 hover:text-neutral-dark transition-colors"
                    aria-label="Follow us on Facebook"
                  >
                    <FacebookIcon size={24} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-3 text-neutral-dark">Quick Links</h4>
            <ul className="space-y-2 text-neutral-dark/70">
              <li>
                <Link to="/home" className="hover:text-neutral-dark transition-colors font-medium">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-neutral-dark transition-colors font-medium">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/clinic" className="hover:text-neutral-dark transition-colors font-medium">
                  Clinic
                </Link>
              </li>
              <li>
                <Link to="/news" className="hover:text-neutral-dark transition-colors font-medium">
                  News
                </Link>
              </li>
              <li>
                <Link to="/become-a-member" className="hover:text-neutral-dark transition-colors font-medium">
                  Become a Member
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-neutral-dark transition-colors font-medium">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Terms */}
          <div>
            <h4 className="text-lg font-semibold mb-3 text-slate-800">Terms</h4>
            <ul className="space-y-2 text-slate-600">
              <li>
                <Link to="/privacy-policy" className="hover:text-slate-800 transition-colors font-medium">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-conditions" className="hover:text-slate-800 transition-colors font-medium">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/copyright-policy" className="hover:text-slate-800 transition-colors font-medium">
                  Copyright Policy
                </Link>
              </li>
              <li>
                <Link to="/code-of-conduct" className="hover:text-slate-800 transition-colors font-medium">
                  Code of Conduct
                </Link>
              </li>
            </ul>
            
            {/* reCAPTCHA Privacy Notice */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed">
                This website uses Google reCAPTCHA v3 for security. By using this site, you agree to Google's{' '}
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-800 underline"
                >
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a 
                  href="https://policies.google.com/terms" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-800 underline"
                >
                  Terms of Service
                </a>.
              </p>
            </div>
          </div>

          {/* Google Map */}
          <div className="md:col-span-2">
            <h4 className="text-lg font-semibold mb-3 text-slate-800">Our Location</h4>
            <div className="flex justify-center">
              <div className="w-full max-w-md h-64 rounded overflow-hidden shadow">
                <iframe
                  title="GAPI Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.1234567890123!2d-83.61234567890123!3d32.61234567890123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88f1234567890123%3A0x1234567890123456!2s106%20Erin%20Lee%20Ct%2C%20Warner%20Robins%2C%20GA%2031008!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
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
        <div className="mt-6 text-center text-slate-600 text-sm">
          <div className="flex flex-col md:flex-row items-center justify-center mt-4 space-y-2 md:space-y-0 md:space-x-4">
            <span className="font-medium">© {year} GAPI. | GAPI.ORG | All Rights Reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
} 
