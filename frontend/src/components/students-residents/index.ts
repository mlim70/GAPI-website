// frontend/src/components/students-residents/index.ts

// Main components
export { default as HeroSection } from './HeroSection.js';
export { default as MissionVisionSection } from './MissionVisionSection.js';
export { default as ExecutiveTeamSection } from './ExecutiveTeamSection.js';
export { default as JoinSection } from './JoinSection.js';
export { default as TeamMemberCard } from './TeamMemberCard.js';

// Data and types
export { teamMembers } from '../../data/students-residents.json';
export type { TeamMember } from '../../types/students-residents.js';

// Hooks
export { useTeamMemberImages } from './hooks/useTeamMemberImages.js';
export { useIntersectionObserver } from './hooks/useIntersectionObserver.js';

// Utils
export { scrollToSection } from '../../utils/scrollUtils.js'; 