// frontend/src/pages/About.tsx
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-dark mb-4">
            About GAPI
          </h1>
          <p className="text-xl text-neutral-dark/80 max-w-2xl mx-auto">
            Learn more about our mission, values, and the community we're building.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 border border-neutral-light">
          <h2 className="text-2xl font-bold text-neutral-dark mb-6">Our Mission</h2>
          <p className="text-neutral-dark/80 mb-6 leading-relaxed">
            GAPI is dedicated to fostering professional growth and creating meaningful connections within our community.
          </p>
          <p className="text-neutral-dark/80 mb-8 leading-relaxed">
            Our organization provides resources, networking opportunities, and support for professionals looking to advance their careers and make a positive impact in their field.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="bg-brand-cream/30 rounded-lg p-6 border border-neutral-light/50">
              <h3 className="text-lg font-semibold text-neutral-dark mb-3">Professional Development</h3>
              <p className="text-neutral-dark/70 text-sm">
                Access to workshops, conferences, and mentorship programs designed to enhance your professional skills.
              </p>
            </div>
            <div className="bg-brand-cream/30 rounded-lg p-6 border border-neutral-light/50">
              <h3 className="text-lg font-semibold text-neutral-dark mb-3">Community Building</h3>
              <p className="text-neutral-dark/70 text-sm">
                Connect with like-minded professionals and build lasting relationships within our supportive network.
              </p>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <Link 
              to="/become-a-member"
              className="inline-flex items-center px-6 py-3 bg-red text-white font-semibold rounded-lg hover:bg-neutral-dark transition-colors"
            >
              Join Our Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 
