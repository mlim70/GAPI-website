// frontend/src/components/students-residents/ExecutiveTeamSection.tsx
import TeamMemberCard from "./TeamMemberCard.js";
import { TeamMember } from "./types";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver.js";

interface ExecutiveTeamSectionProps {
  teamMembers: TeamMember[];
  memberImages: Record<string, string>;
  activeSection: string | null;
  onToggleSection: (memberId: string) => void;
}

export default function ExecutiveTeamSection({
  teamMembers,
  memberImages,
  activeSection,
  onToggleSection
}: ExecutiveTeamSectionProps) {
  const { elementRef, hasTriggered } = useIntersectionObserver({
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px'
  });

  return (
    <section 
      id="team-section"
      ref={elementRef}
      aria-labelledby="executive-team-heading"
      className={`transition-opacity duration-700 ease-out transition-transform duration-700 ease-out ${
        hasTriggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="text-center mb-16">
        <h2 id="executive-team-heading" className="text-5xl font-bold text-neutral-dark mb-6">Meet Our Executive Team</h2>
        <p className="text-xl text-neutral-dark/70 max-w-3xl mx-auto">
          The 2025-2026 leadership team dedicated to empowering medical students and residents
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {teamMembers.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            memberImages={memberImages}
            activeSection={activeSection}
            onToggleSection={onToggleSection}
          />
        ))}
      </div>
    </section>
  );
} 