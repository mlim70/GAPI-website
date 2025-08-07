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
      <div className="text-center mb-16">
        <h2 id="mission-vision-heading" className="text-4xl font-bold text-neutral-dark mb-4">Our Mission & Vision</h2>
        <p className="text-xl text-neutral-dark/70 max-w-2xl mx-auto">
          Building the future of healthcare through mentorship, collaboration, and community
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Mission Card */}
        <div className="group relative bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow duration-500 ease-out transform hover:-translate-y-2 transition-transform duration-500 ease-out">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red to-red/70 rounded-t-2xl"></div>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red/10 rounded-xl">
              <Target className="w-8 h-8 text-red" aria-hidden="true" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-dark">Mission</h3>
          </div>
          <p className="text-neutral-dark/80 leading-relaxed text-lg">
            The mission of GAPI MSRF is to cultivate a vibrant community of medical students and residents of
            Indian heritage across Georgia. We are committed to fostering professional growth through mentorship,
            advancing academic excellence through research and scholarly exchange, and strengthening our
            collective impact through dedicated service. Through these pillars, we aim to empower the next
            generation of physicians to thrive, lead, and give back.
          </p>
          <div className="mt-6 flex items-center gap-2 text-red font-semibold group-hover:gap-3 transition-all duration-300 ease-out">
            <span>Learn More</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300 ease-out" />
          </div>
        </div>

        {/* Vision Card */}
        <div className="group relative bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow duration-500 ease-out transform hover:-translate-y-2 transition-transform duration-500 ease-out">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-t-2xl"></div>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-600/10 rounded-xl">
              <Eye className="w-8 h-8 text-blue-600" aria-hidden="true" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-dark">Vision</h3>
          </div>
          <p className="text-neutral-dark/80 leading-relaxed text-lg">
            Our vision is to be the leading network for Indian-origin medical trainees in Georgia to be a place where
            mentorship is personal, collaboration is purposeful, and community is foundational. We envision a
            future where every GAPI MSRF member is equipped with the support, inspiration, and opportunities
            needed to grow into compassionate, skilled, and visionary leaders in medicine.
          </p>
          <div className="mt-6 flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all duration-300 ease-out">
            <span>Discover More</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300 ease-out" />
          </div>
        </div>
      </div>
    </section>
  );
} 