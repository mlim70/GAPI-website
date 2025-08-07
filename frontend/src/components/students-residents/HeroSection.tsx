// frontend/src/components/students-residents/HeroSection.tsx
import { useRef } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

interface HeroSectionProps {
  onScrollToSection: (sectionId: string) => void;
}

export default function HeroSection({ onScrollToSection }: HeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <header 
      ref={heroRef}
      className="relative bg-gradient-to-br from-red via-red/95 to-red/90 text-white py-32 overflow-hidden"
      role="banner"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-8">
            <span className="block">Medical Students,</span>
            <span className="block text-white/90">Residents Forum</span>
          </h1>
          
          <p className="text-xl lg:text-2xl text-white/90 max-w-4xl mx-auto leading-relaxed mb-16">
            Georgia Physicians of Indian Heritage – Medical Students and Residents Forum
          </p>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button 
              onClick={() => onScrollToSection('join-section')}
              className="group bg-white text-red px-10 py-5 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-red"
              aria-label="Join our community - scroll to join section"
            >
              Join Our Community
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </button>
            <button 
              onClick={() => onScrollToSection('team-section')}
              className="group border-2 border-white/50 text-white px-10 py-5 rounded-full font-semibold text-lg hover:bg-white/10 transition-all duration-300 backdrop-blur-sm flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-red"
              aria-label="Meet our team - scroll to team section"
            >
              Meet Our Team
              <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent" aria-hidden="true"></div>
    </header>
  );
} 