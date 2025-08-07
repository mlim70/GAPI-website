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
      className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white min-h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] lg:h-[600px] flex items-center justify-center overflow-hidden"
      role="banner"
    >
      {/* Static Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800"></div>
      
      {/* Subtle Mesh Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold/10 via-transparent to-purple/10 opacity-40"></div>
      
      {/* Subtle Geometric Shapes */}
      <div className="absolute top-20 left-20 w-48 h-48 bg-gold/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple/5 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-10 w-32 h-32 bg-gold/5 rounded-full blur-2xl"></div>
      <div className="absolute top-1/3 right-10 w-36 h-36 bg-purple/3 rounded-full blur-3xl"></div>
      
      {/* Animated Grid Lines */}
      <div className="absolute inset-0 opacity-8">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h100v100H0z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-8 border border-white/20">
            <div className="w-3 h-3 bg-red rounded-full animate-pulse"></div>
            <span className="text-white/90 font-semibold text-lg tracking-wide">GAPI-MSRF</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-8">
            <span className="block bg-gradient-to-r from-white via-white/95 to-white/90 bg-clip-text text-transparent animate-fade-in">Medical Students,</span>
            <span className="block bg-gradient-to-r from-white/95 via-white/90 to-white/85 bg-clip-text text-transparent animate-fade-in-delayed">Residents Forum</span>
          </h1>
          
          <p className="text-xl lg:text-2xl text-white/90 max-w-4xl mx-auto leading-relaxed mb-16 animate-fade-in-delayed-2">
            Georgia Physicians of Indian Heritage – Medical Students and Residents Forum
          </p>

          {/* Enhanced Call to Action */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-fade-in-delayed-3">
            <button 
              onClick={() => onScrollToSection('join-section')}
              className="group bg-gradient-to-r from-red via-red/95 to-red/90 text-white px-12 py-6 rounded-full font-semibold text-lg hover:from-red/90 hover:via-red/85 hover:to-red/80 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-red/50 focus:ring-offset-2 focus:ring-offset-slate-900 backdrop-blur-sm"
              aria-label="Join our community - scroll to join section"
            >
              Join Our Community
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </button>
            <button 
              onClick={() => onScrollToSection('team-section')}
              className="group border-2 border-white/50 text-white px-12 py-6 rounded-full font-semibold text-lg hover:bg-white/10 hover:border-white/70 transition-all duration-300 backdrop-blur-md flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg"
              aria-label="Meet our team - scroll to team section"
            >
              Meet Our Team
              <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`

        

        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        

        

        
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        
        .animate-fade-in-delayed {
          animation: fade-in 1s ease-out 0.2s forwards;
          opacity: 0;
        }
        
        .animate-fade-in-delayed-2 {
          animation: fade-in 1s ease-out 0.4s forwards;
          opacity: 0;
        }
        
        .animate-fade-in-delayed-3 {
          animation: fade-in 1s ease-out 0.6s forwards;
          opacity: 0;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-fade-in-delayed,
          .animate-fade-in-delayed-2,
          .animate-fade-in-delayed-3 {
            animation: none;
          }
        }
      `}</style>
    </header>
  );
} 