// frontend/src/components/students-residents/TeamMemberCard.tsx
import { ReactNode, memo, useState } from "react";
import { ChevronDown } from "lucide-react";

interface TeamMember {
  id: string;
  role: string;
  name: string;
  school: string;
  year: string;
  icon: ReactNode;
  bio: string[];
}

interface TeamMemberCardProps {
  member: TeamMember;
  memberImages: Record<string, string>;
  activeSection: string | null;
  onToggleSection: (memberId: string) => void;
}

const TeamMemberCard = memo(function TeamMemberCard({ 
  member, 
  memberImages, 
  activeSection, 
  onToggleSection
}: TeamMemberCardProps) {
  const isExpanded = activeSection === member.id;
  const hasMultipleParagraphs = member.bio.length > 1;
  const hasImage = memberImages[member.id];
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    console.log(`✅ Image loaded for ${member.name}`);
    setImageError(false);
  };

  const handleImageError = () => {
    console.log(`❌ Image failed to load for ${member.name}`);
    setImageError(true);
  };

  // Determine what to show: image or fallback icon
  const shouldShowImage = hasImage && !imageError;

  return (
    <article 
      className={`group relative bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300 ease-out cursor-pointer ${
        isExpanded ? 'ring-2 ring-red/50 shadow-2xl' : ''
      }`}
      onClick={() => onToggleSection(member.id)}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      aria-label={`${member.name}, ${member.role} - ${isExpanded ? 'expanded' : 'collapsed'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSection(member.id);
        }
      }}
    >


      {/* Header */}
      <header className="flex items-start gap-6 mb-6 pt-4">
        {/* Member Image or Icon */}
        <div className="relative flex-shrink-0 w-48 h-48">
          {shouldShowImage ? (
            <div className="w-48 h-48 rounded-full shadow-lg overflow-hidden transition-transform duration-300 ease-out group-hover:scale-102" style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}>
              <img
                src={memberImages[member.id]}
                alt={`${member.name} - ${member.role}`}
                loading="lazy"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: member.id === 'president' ? 'center 25%' :
                                 member.id === 'president-elect' ? '74% 60%' :
                                 member.id === 'secretary' ? 'center 40%' :
                                 member.id === 'treasurer' ? 'center 20%' : 'center center',
                  transform: member.id === 'president' ? 'scale(1)' :
                            member.id === 'president-elect' ? 'scale(1.4) translateY(16px)' :
                            member.id === 'secretary' ? 'scale(1.65) translateY(14px)' :
                            member.id === 'treasurer' ? 'scale(1)' :
                            'scale(1)',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-full bg-red/10 flex items-center justify-center shadow-lg">
              <div className="w-24 h-24 text-red">
                {member.icon}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-4xl font-bold text-neutral-dark">{member.name}</h3>
            <div className="bg-gradient-to-r from-red to-red/80 text-white px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap">
              {member.role}
            </div>
          </div>
          <p className="text-red font-semibold text-xl mb-2">{member.school}</p>
          <p className="text-neutral-dark/60 text-base font-medium">{member.year}</p>
        </div>
      </header>

      {/* Divider */}
      <div className="flex items-center justify-center my-6 gap-3">
        <div className="w-8 h-px bg-red/40"></div>
        <div className="w-2 h-2 rounded-full bg-red/60"></div>
        <div className="w-8 h-px bg-red/40"></div>
      </div>

      {/* Bio - Expandable */}
      <div className="space-y-4">
        {member.bio.slice(0, isExpanded ? member.bio.length : 1).map((paragraph, pIndex) => (
          <p key={pIndex} className="text-neutral-dark/80 leading-relaxed">
            {paragraph}
          </p>
        ))}
        
        {hasMultipleParagraphs && (
          <button 
            className="text-red font-semibold hover:text-red/80 transition-colors duration-300 ease-out flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red/50 focus:ring-offset-2 focus:ring-offset-white rounded-md px-2 py-1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSection(member.id);
            }}
            aria-label={`${isExpanded ? 'Show less' : 'Read more'} about ${member.name}`}
          >
            {isExpanded ? 'Show Less' : 'Read More'}
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-out ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>


    </article>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for more precise memoization
  return (
    prevProps.member.id === nextProps.member.id &&
    prevProps.member.name === nextProps.member.name &&
    prevProps.member.role === nextProps.member.role &&
    prevProps.member.school === nextProps.member.school &&
    prevProps.member.year === nextProps.member.year &&
    prevProps.member.bio.length === nextProps.member.bio.length &&
    prevProps.memberImages[prevProps.member.id] === nextProps.memberImages[nextProps.member.id] &&
    prevProps.activeSection === nextProps.activeSection
  );
});

export default TeamMemberCard; 