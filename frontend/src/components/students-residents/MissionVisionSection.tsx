// frontend/src/components/students-residents/MissionVisionSection.tsx
import { Target, Eye, ArrowRight } from "lucide-react";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver.js";

export default function MissionVisionSection() {
  const { elementRef, hasTriggered } = useIntersectionObserver({
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px'
  });

  return (
    <section 
      ref={elementRef}
      aria-labelledby="mission-vision-heading"
      className={`transition-opacity duration-700 ease-out transition-transform duration-700 ease-out ${
        hasTriggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="text-center mb-20">
        <h2 id="mission-vision-heading" className="text-5xl font-bold text-neutral-dark mb-6">Our Mission & Vision</h2>
        <p className="text-xl text-neutral-dark/70 max-w-3xl mx-auto leading-relaxed">
          Building the future of healthcare through mentorship, collaboration, and community
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Mission Card */}
        <div className="relative bg-gradient-to-br from-white to-gray-50/50 rounded-3xl shadow-xl p-10 border border-gray-200/50">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red via-red/80 to-red/60 rounded-t-3xl"></div>
          
          <div className="mb-8 pt-4">
            <h3 className="text-3xl font-bold text-neutral-dark mb-6">Mission</h3>
            <div className="w-16 h-0.5 bg-red/60"></div>
          </div>
          
          <div className="space-y-6">
            <p className="text-neutral-dark/90 leading-relaxed text-lg">
              The mission of GAPI MSRF is to cultivate a vibrant community of medical students and residents of
              Indian heritage across Georgia. We are committed to fostering professional growth through mentorship,
              advancing academic excellence through research and scholarly exchange, and strengthening our
              collective impact through dedicated service.
            </p>
            <div className="relative">
              <div className="absolute left-0 top-0 w-1 h-6 bg-red/60 rounded-full"></div>
              <p className="text-neutral-dark/80 leading-relaxed" style={{ textIndent: '24px' }}>
                Through these pillars, we aim to empower the next generation of physicians to thrive, lead, and give back.
              </p>
            </div>
          </div>
        </div>

        {/* Vision Card */}
        <div className="relative bg-gradient-to-br from-white to-blue-50/60 rounded-3xl shadow-xl p-10 border border-gray-200/50">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 rounded-t-3xl"></div>
          
          <div className="mb-8 pt-4">
            <h3 className="text-3xl font-bold text-neutral-dark mb-6">Vision</h3>
            <div className="w-16 h-0.5 bg-blue-600/60"></div>
          </div>
          
          <div className="space-y-6">
            <p className="text-neutral-dark/90 leading-relaxed text-lg">
              Our vision is to be the leading network for Indian-origin medical trainees in Georgia to be a place where
              mentorship is personal, collaboration is purposeful, and community is foundational.
            </p>
            <div className="relative">
              <div className="absolute left-0 top-0 w-1 h-6 bg-blue-600/60 rounded-full"></div>
              <p className="text-neutral-dark/80 leading-relaxed" style={{ textIndent: '24px' }}>
                We envision a future where every GAPI MSRF member is equipped with the support, inspiration, and opportunities
                needed to grow into compassionate, skilled, and visionary leaders in medicine.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 