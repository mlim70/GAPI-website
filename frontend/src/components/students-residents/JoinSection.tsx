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
      className={`bg-gradient-to-br from-red via-red/95 to-red/90 text-white rounded-3xl p-12 transition-opacity duration-700 ease-out transition-transform duration-700 ease-out ${
        hasTriggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm" aria-hidden="true">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h2 id="join-heading" className="text-4xl font-bold">Join GAPI-MSRF</h2>
        </div>
        
        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          Connect with fellow medical students and residents, access mentorship opportunities, and be part of a vibrant community
        </p>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl" aria-hidden="true">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">Contact our Secretary</p>
                <p className="text-white/90">Keerti Soundapan</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl" aria-hidden="true">
                <Phone className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">Cell: 478-396-3995</p>
                <p className="text-white/90">to be added to the WhatsApp group</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 