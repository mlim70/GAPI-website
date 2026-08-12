// frontend/src/components/students-residents/hooks/useTeamMemberImages.ts
import { useMemo } from "react";
import execImagePaths from "../../../data/execImages.json";
import { teamMembers } from "../../../data/students-residents.json";
import { logger } from "../../../utils/logger";

const TITLES = ['dr.', 'dr', 'professor', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms'];

/** "Dr. Anita Patel" → "anita" (skips honorifics) */
function firstNameOf(fullName: string): string {
  const parts = fullName.split(' ');
  const first = parts[0] ?? '';
  const name = TITLES.includes(first.toLowerCase()) ? (parts[1] ?? first) : first;
  return name.toLowerCase();
}

export function useTeamMemberImages() {
  const memberImages = useMemo(() => {
    const imageMap: Record<string, string> = {};

    teamMembers.forEach(member => {
      // Exec photos are named "exec-<FirstName>.<ext>" in /images/exec/
      const imageKey = `exec-${firstNameOf(member.name)}`;

      const matchingImage = execImagePaths.find(path =>
        path.toLowerCase().includes(imageKey)
      );

      if (matchingImage) {
        imageMap[member.id] = matchingImage;
      } else {
        logger.debug(`No image found for ${member.name} (${imageKey})`);
      }
    });

    return imageMap;
  }, []);

  // Static images resolve synchronously — kept in the return shape so callers
  // don't have to change.
  return {
    memberImages,
    isLoading: false,
    error: null as string | null
  };
}
