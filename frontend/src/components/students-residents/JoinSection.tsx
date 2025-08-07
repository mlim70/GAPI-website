// frontend/src/components/students-residents/JoinSection.tsx
import { MessageCircle, Phone } from "lucide-react";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver.js";

export default function JoinSection() {
  const { elementRef, hasTriggered } = useIntersectionObserver({
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px'
  });

  return (
    <section 
      id="join-section"
      ref={elementRef}
      aria-labelledby="join-heading"
      className={`transition-opacity duration-700 ease-out transition-transform duration-700 ease-out ${
        hasTriggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="bg-gradient-to-br from-red via-red/95 to-red/90 text-white rounded-3xl p-12 shadow-2xl">
        <div className="text-center max-w-4xl mx-auto">
          <h2 id="join-heading" className="text-4xl font-bold mb-8">Join GAPI-MSRF</h2>
          
          <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            Connect with fellow medical students and residents, access mentorship opportunities, and be part of a vibrant community dedicated to professional growth and service
          </p>

          {/* Contact Information */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl flex-shrink-0" aria-hidden="true">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2">Contact Our Secretary</h3>
                  <p className="text-white/90">Keerti Soundapan</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl flex-shrink-0" aria-hidden="true">
                  <Phone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2">Join Our WhatsApp Group</h3>
                  <p className="text-white/90">Cell: 478-396-3995</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 