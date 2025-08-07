// frontend/src/components/students-residents/JoinSection.tsx
import { MessageCircle, Phone } from "lucide-react";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver.js";

export default function JoinSection() {
  const { elementRef, hasTriggered } = useIntersectionObserver({
    threshold: 0,
    rootMargin: '0px 0px -200px 0px'
  });

  return (
    <section 
      id="join-section"
      ref={elementRef}
      aria-labelledby="join-heading"
      className={`transition-all duration-1000 ease-out ${
        hasTriggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
             <div className="bg-gradient-to-br from-red via-red/95 to-red/90 text-white rounded-3xl p-8 shadow-2xl">
         <div className="text-center max-w-4xl mx-auto">
           <h2 id="join-heading" className="text-4xl font-bold mb-6">Join GAPI-MSRF</h2>
           
           <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
             Connect with fellow medical students and residents, access mentorship opportunities, and be part of a vibrant community dedicated to professional growth and service
           </p>

           {/* Contact Information */}
           <div className="max-w-2xl mx-auto">
             <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
               <div className="text-center">
                 <h3 className="font-bold text-xl mb-1">Join Our WhatsApp Group</h3>
                 <p className="text-white/90 text-lg">Contact Keerti Soundapan</p>
                 <p className="text-white/80 text-base">Secretary, GAPI-MSRF</p>
                 <div className="flex items-center justify-center gap-2 mt-1">
                   <Phone className="w-5 h-5 text-white/90" />
                   <p className="text-white/90 text-lg">Cell: 478-396-3995</p>
                 </div>
                 <p className="text-white/80 text-base mt-1">Text or call to be added to the group</p>
               </div>
             </div>
           </div>
         </div>
       </div>
    </section>
  );
} 