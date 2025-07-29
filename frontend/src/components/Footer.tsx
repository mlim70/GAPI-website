import React from 'react';
import { MapPin, Mail, X, FacebookIcon } from 'lucide-react';
import gapiLogo from '../assets/gapi_logo.png';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <div className="relative">
      {/* Logo Overlay */}
      <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <img 
          src={gapiLogo} 
          alt="GAPI Logo" 
          className="w-56 h-56 md:w-72 md:h-72 lg:w-96 lg:h-96 object-contain"
        />
      </div>
      
      <footer className="bg-slate-100 text-slate-700 py-8 border-t border-slate-200 relative">
        <div className="container mx-auto mr-12 my-10 grid grid-cols-1 md:grid-cols-5 gap-16 px-6 sm:px-8 lg:px-16 max-w-7xl">
          {/* Left Column - Contact Info */}
          <div className="md:pl-0">
            <div className="grid grid-cols-1 gap-6">
              {/* Contact Info */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-slate-800">Contact Us</h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-500" />
                    <div>
                      <p className="font-medium">106 Erin Lee Court</p>
                      <p className="font-medium">Warner Robins, GA 31008</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 flex-shrink-0 text-slate-500" />
                    <a 
                      href="mailto:info@gapi.org" 
                      className="underline hover:text-slate-800 transition-colors font-medium"
                    >
                      info@gapi.org
                    </a>
                  </div>

                </div>
              </div>

              {/* Social Media */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-slate-800">Follow Us</h4>
                <div className="flex items-center space-x-4">
                  <a 
                    href="https://x.com/gapigeorgia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-800 transition-colors"
                    aria-label="Follow us on X (Twitter)"
                  >
                    <X size={24} />
                  </a>
                  <a 
                    href="https://www.facebook.com/profile.php?id=100064418690446&ref=br_rs#" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-800 transition-colors"
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
            <h4 className="text-lg font-semibold mb-3 text-slate-800">Quick Links</h4>
            <ul className="space-y-2 text-slate-600">
              <li>
                <a href="/" className="hover:text-slate-800 transition-colors font-medium">
                  Home
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-slate-800 transition-colors font-medium">
                  About Us
                </a>
              </li>
              <li>
                <a href="/clinic" className="hover:text-slate-800 transition-colors font-medium">
                  Clinic
                </a>
              </li>
              <li>
                <a href="/news" className="hover:text-slate-800 transition-colors font-medium">
                  News
                </a>
              </li>
              <li>
                <a href="/become-a-member" className="hover:text-slate-800 transition-colors font-medium">
                  Become a Member
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-slate-800 transition-colors font-medium">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Terms */}
          <div>
            <h4 className="text-lg font-semibold mb-3 text-slate-800">Terms</h4>
            <ul className="space-y-2 text-slate-600">
              <li>
                <a href="/privacy-policy" className="hover:text-slate-800 transition-colors font-medium">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms-conditions" className="hover:text-slate-800 transition-colors font-medium">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="/copyright-policy" className="hover:text-slate-800 transition-colors font-medium">
                  Copyright Policy
                </a>
              </li>
              <li>
                <a href="/code-of-conduct" className="hover:text-slate-800 transition-colors font-medium">
                  Code of Conduct
                </a>
              </li>
            </ul>
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