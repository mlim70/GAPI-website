// frontend/src/components/students-residents/MissionVisionSection.tsx
import { Target, Eye, ArrowRight } from "lucide-react";

export default function MissionVisionSection() {
  return (
    <section 
      aria-labelledby="mission-vision-heading"
    >
      <div className="text-center mb-16">
        <h2 id="mission-vision-heading" className="text-4xl font-bold text-neutral-dark mb-4">Our Mission & Vision</h2>
        <p className="text-lg text-neutral-dark/70 max-w-2xl mx-auto leading-relaxed">
          Building the future of healthcare through mentorship, collaboration, and community
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Mission Card */}
        <div className="relative bg-white rounded-xl shadow-sm border border-neutral-light p-6">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-red rounded-t-xl"></div>
          
          <div className="mb-6">
            <h3 className="text-2xl font-semibold text-neutral-dark mb-3">Mission</h3>
            <div className="w-12 h-0.5 bg-red/40"></div>
          </div>
          
          <div className="space-y-4">
            <p className="text-neutral-dark/80 leading-relaxed text-base">
              The mission of GAPI MSRF is to cultivate a vibrant community of medical students and residents of
              Indian heritage across Georgia. We are committed to fostering professional growth through mentorship,
              advancing academic excellence through research and scholarly exchange, and strengthening our
              collective impact through dedicated service. Through these pillars, we aim to empower the next
              generation of physicians to thrive, lead, and give back.
            </p>
          </div>
        </div>

        {/* Vision Card */}
        <div className="relative bg-white rounded-xl shadow-sm border border-neutral-light p-6">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800 rounded-t-xl"></div>
          
          <div className="mb-6">
            <h3 className="text-2xl font-semibold text-neutral-dark mb-3">Vision</h3>
            <div className="w-12 h-0.5 bg-gray-800/40"></div>
          </div>
          
          <div className="space-y-4">
            <p className="text-neutral-dark/80 leading-relaxed text-base">
              Our vision is to be the leading network for Indian-origin medical trainees in Georgia to be a place where
              mentorship is personal, collaboration is purposeful, and community is foundational. We envision a
              future where every GAPI MSRF member is equipped with the support, inspiration, and opportunities
              needed to grow into compassionate, skilled, and visionary leaders in medicine.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 