// frontend/src/components/students-residents/hooks/useTeamMemberImages.ts
import { useState, useEffect } from "react";
import { fetchS3ImagesFromFolder } from "../../../api/s3.js";
import { getS3Buckets, getS3Folders } from "../../../config/s3.js";
import { teamMembers } from "../data.js";

export function useTeamMemberImages() {
  const [memberImages, setMemberImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemberImages = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const s3Buckets = getS3Buckets();
        const s3Folders = getS3Folders();

        console.log('🔍 Fetching team member images from S3:', {
          bucket: s3Buckets.exec,
          folder: s3Folders.exec
        });

        // Fetch images from S3 using presigned URLs
        const images = await fetchS3ImagesFromFolder(s3Buckets.exec, s3Folders.exec || '');

        if (images && images.length > 0) {
          const imageMap: Record<string, string> = {};

          teamMembers.forEach(member => {
            // Extract first name, handling titles like "Dr."
            const nameParts = member.name.split(' ');
            let firstName = nameParts[0];

            // Skip titles and get the actual first name
            const titles = ['dr.', 'dr', 'professor', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms'];
            if (titles.includes(firstName.toLowerCase())) {
              firstName = nameParts[1]; // Use second word if first is a title
            }

            const imageKey = `exec-${firstName}`;

            const matchingImage = images.find(img =>
              img.key.toLowerCase().includes(imageKey.toLowerCase())
            );

            if (matchingImage) {
              console.log(`✅ Found image for ${member.name}:`, matchingImage.url);
              imageMap[member.id] = matchingImage.url;
            } else {
              console.log(`❌ No image found for ${member.name} (${imageKey})`);
            }
          });

          setMemberImages(imageMap);
        } else {
          console.log('❌ No images found in S3 bucket');
        }
      } catch (error) {
        console.error('❌ Error fetching team member images:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch images');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberImages();
  }, []);

  return {
    memberImages,
    isLoading,
    error
  };
} 