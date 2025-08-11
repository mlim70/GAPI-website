// frontend/src/components/students-residents/ExecutiveTeamSection.tsx
import TeamMemberCard from "./TeamMemberCard.js";
import { TeamMember } from "./types";

interface ExecutiveTeamSectionProps {
  teamMembers: TeamMember[];
  memberImages: Record<string, string>;
}

export default function ExecutiveTeamSection({
  teamMembers,
  memberImages
}: ExecutiveTeamSectionProps) {
  return (
    <section 
      id="team-section"
      aria-labelledby="executive-team-heading"
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
            activeSection={null}
            onToggleSection={() => {}}
          />
        ))}
      </div>
    </section>
  );
} 