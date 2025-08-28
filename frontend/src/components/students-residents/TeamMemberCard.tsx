// frontend/src/components/students-residents/TeamMemberCard.tsx
import { memo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, GraduationCap, Star, MessageCircle, Heart } from "lucide-react";

interface TeamMember {
  id: string;
  role: string;
  name: string;
  school: string;
  year: string;
  iconName: string;
  bio: string[];
}

// Icon mapping for dynamic icon rendering
const iconMap = {
  'graduation-cap': GraduationCap,
  'star': Star,
  'message-circle': MessageCircle,
  'heart': Heart
};

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
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Get the icon component based on iconName
  const IconComponent = iconMap[member.iconName as keyof typeof iconMap] || GraduationCap;

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleCardClick = () => {
    if (hasMultipleParagraphs) {
      setShowModal(true);
    }
  };

  const handleModalClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosing(false);
    }, 300);
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        handleModalClose();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  // Handle click outside modal to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleModalClose();
    }
  };

  // Modal content
  const modalContent = (showModal || isClosing) && mounted ? (
    <div 
      className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-2 sm:p-4 transition-all duration-300 ease-out ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleBackdropClick}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
              <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto transform transition-all duration-300 ease-out border border-gray-100 relative ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}>
        {/* Close button - positioned absolutely */}
        <button
          onClick={handleModalClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-3 text-gray-400 hover:text-neutral-dark transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red/50 hover:scale-110 z-10"
          aria-label="Close bio modal"
        >
          <X className="w-7 h-7" />
        </button>

                 {/* Modal Content */}
         <div className="p-6 sm:p-8">
           <div className="flex flex-col xl:flex-row xl:items-start gap-6 xl:gap-10 mb-8">
             {/* Member Image - Left side on desktop */}
             <div className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 xl:w-40 xl:h-40 mx-auto xl:mx-0">
               {shouldShowImage ? (
                 <div className="w-28 h-28 sm:w-32 sm:h-32 xl:w-40 xl:h-40 rounded-2xl shadow-lg overflow-hidden border-2 border-gray-200">
                   <img
                     src={memberImages[member.id]}
                     alt={`${member.name} - ${member.role}`}
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
                     }}
                   />
                 </div>
               ) : (
                 <div className="w-28 h-28 sm:w-32 sm:h-32 xl:w-40 xl:h-40 rounded-2xl bg-gray-100 flex items-center justify-center shadow-lg border-2 border-gray-200">
                   <div className="w-14 h-14 sm:w-16 sm:h-16 xl:w-20 xl:h-20 text-gray-400">
                     <IconComponent className="w-full h-full" />
                   </div>
                 </div>
               )}
             </div>
             
             {/* Member Information - Right side on desktop */}
             <div className="flex-1 text-center xl:text-left">
               <div className="space-y-3">
                 <h2 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-gray-900">
                   {member.name}
                 </h2>
                 
                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center xl:justify-start gap-2 sm:gap-4">
                   <span className="inline-block bg-gradient-to-r from-red to-red/80 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold">
                     {member.role}
                   </span>
                 </div>
                 
                 <span className="text-gray-600 text-sm font-medium">
                   {member.school}
                 </span>
                 
                 <p className="text-gray-500 text-sm">
                   {member.year}
                 </p>
               </div>
             </div>
           </div>

           {/* Bio Content */}
           <div className="bg-gray-50 rounded-xl p-6 sm:p-8">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-1 h-6 bg-red rounded-full"></div>
               <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Biography</h3>
               <div className="flex-1 h-px bg-gray-300"></div>
             </div>
             <div className="space-y-4">
               {member.bio.map((paragraph, index) => (
                 <p key={index} className="text-gray-700 leading-relaxed text-base sm:text-lg">
                   {paragraph}
                 </p>
               ))}
             </div>
           </div>
         </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <article 
        className={`group relative bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 ease-out focus:outline-none ${
          hasMultipleParagraphs ? 'cursor-pointer' : ''
        }`}
        onClick={handleCardClick}
        tabIndex={0}
        role={hasMultipleParagraphs ? "button" : "article"}
        aria-label={hasMultipleParagraphs ? `View full bio for ${member.name}` : `${member.name}, ${member.role}`}
        onKeyDown={(e) => {
          if (hasMultipleParagraphs && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Mobile-optimized layout */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Header - Stacked on mobile, side-by-side on larger screens */}
          <header className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6 pt-2 sm:pt-4">
            {/* Member Image or Icon - Centered on mobile */}
            <div className="relative flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48">
              {shouldShowImage ? (
                <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full shadow-lg overflow-hidden transition-transform duration-300 ease-out group-hover:scale-102 border-2 border-gray-200" style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}>
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
                <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full bg-red/10 flex items-center justify-center shadow-lg border-2 border-gray-200">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-red">
                    <IconComponent className="w-full h-full" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Member Info - Centered on mobile, left-aligned on larger screens */}
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-dark mb-2 sm:mb-3 leading-tight">
                {member.name}
              </h3>
              <div className="bg-gradient-to-r from-red to-red/80 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap w-fit mx-auto sm:mx-0 mb-3 sm:mb-4">
                {member.role}
              </div>
              <p className="text-red font-semibold text-lg sm:text-xl mb-1 sm:mb-2 leading-tight">
                {member.school}
              </p>
              <p className="text-neutral-dark/60 text-sm sm:text-base font-medium">
                {member.year}
              </p>
            </div>
          </header>

          {/* Divider - Hidden on mobile for cleaner look */}
          <div className="hidden sm:flex items-center justify-center my-6 gap-3">
            <div className="w-8 h-px bg-red/40"></div>
            <div className="w-2 h-2 rounded-full bg-red/60"></div>
            <div className="w-8 h-px bg-red/40"></div>
          </div>

          {/* Bio - Optimized for mobile reading */}
          <div className="space-y-3 sm:space-y-4">
            <p className="text-neutral-dark/80 leading-relaxed text-sm sm:text-base">
              {member.bio[0]}
            </p>
            
            {hasMultipleParagraphs && (
              <button 
                className="text-red font-semibold hover:text-red/80 transition-colors duration-300 ease-out flex items-center justify-center sm:justify-start gap-2 focus:outline-none focus:ring-2 focus:ring-red/50 focus:ring-offset-2 focus:ring-offset-white rounded-md px-3 py-2 w-full sm:w-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModal(true);
                }}
                aria-label={`Read full bio for ${member.name}`}
              >
                Read Full Bio
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </article>

      {/* Render modal using portal */}
      {mounted && createPortal(modalContent, document.body)}
    </>
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