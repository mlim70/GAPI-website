// frontend/src/pages/StudentsResidents.tsx
import {
  HeroSection,
  MissionVisionSection,
  ExecutiveTeamSection,
  JoinSection,
  teamMembers,
  scrollToSection
} from "../../../components/students-residents/index.js";
import { useTeamMemberImages } from "../../../components/students-residents/hooks/useTeamMemberImages.js";

export default function StudentsResidents() {
  const { memberImages, isLoading, error } = useTeamMemberImages();

  return (
    <main className="min-h-screen" style={{
      background: 'linear-gradient(to bottom, white 0%, white 60%, rgb(249 250 251) 80%, rgb(249 250 251) 95%, rgb(249 250 251) 100%)'
    }}>
      {/* Skip Link for Accessibility */}
      <a 
        href="#mission-vision-heading" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-red text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-white/50"
      >
        Skip to main content
      </a>

      <HeroSection onScrollToSection={scrollToSection} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="space-y-32">
          <MissionVisionSection />
          
          <ExecutiveTeamSection
            teamMembers={teamMembers}
            memberImages={memberImages}
          />
          
          <JoinSection />
        </div>
      </div>

      {/* CSS for reduced motion preference */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
} 