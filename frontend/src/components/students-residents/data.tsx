// frontend/src/components/students-residents/data.tsx
import { GraduationCap, Star, MessageCircle, Heart } from "lucide-react";
import { TeamMember } from "./types.js";

export const teamMembers: TeamMember[] = [
  {
    id: 'president',
    role: 'President',
    name: 'Anita Medepalli',
    school: 'Mercer University School of Medicine',
    year: 'Fourth-year medical student',
    icon: <GraduationCap className="w-6 h-6" />,
    bio: [
      "My name is Anita Medepalli, and I'm a fourth-year medical student at Mercer University School of Medicine in Macon, Georgia. I also completed my undergraduate degree at Mercer, majoring in Biology with minors in Chemistry, Public Health, and Spanish.",
      "Getting involved with GAPI-MSRF has been one of the most meaningful parts of my medical school experience. As someone passionate about mentorship, representation, and building community, I was drawn to the organization's mission from the start.",
      "I joined in 2022 as a founding member and served as our chapter's first secretary, working alongside a small team to host our inaugural event and lay the foundation for future growth. Since then, I've seen how powerful it can be when students from across Georgia come together to share experiences, support one another, and connect with physician mentors who reflect our diverse backgrounds.",
      "As President, I'm excited to continue growing that network and creating opportunities for medical students to lead, learn, and uplift each other."
    ]
  },
  {
    id: 'president-elect',
    role: 'President-Elect',
    name: 'Varun Nukala',
    school: 'Medical College of Georgia',
    year: 'Third-year medical student',
    icon: <Star className="w-6 h-6" />,
    bio: [
      "My name is Varun Nukala, and I am a third-year medical student at the Medical College of Georgia, currently rotating at the Southwest Regional Campus.",
      "I have been involved with GAPI for many years and have seen firsthand how it can be a powerful platform for advocacy, service and education. Through GAPI, I have found a vibrant community that fosters networking and mentorship between physicians and medical trainees from across the state.",
      "As president-elect, I hope to expand medical student involvement, create meaningful avenues for mentorship and harness the potential of GAPI to improve healthcare in Georgia through advocacy and service."
    ]
  },
  {
    id: 'secretary',
    role: 'Secretary',
    name: 'Keerti Soundapan',
    school: 'Medical College of Georgia',
    year: 'Third-year medical student',
    icon: <MessageCircle className="w-6 h-6" />,
    bio: [
      "My name is Keerti Soundapan, a third-year medical student at the Medical College of Georgia.",
      "Being involved with GAPI has given me the opportunity to connect with mentors, celebrate shared cultural roots, and gain insight into the unique challenges faced by our communities.",
      "I believe it is essential for medical students to stay engaged in organizations like GAPI throughout their training—not only to build strong networks, but also to grow as culturally competent and community-minded physicians.",
      "As Secretary, I hope to improve communication, increase student involvement, and help create more spaces for collaboration, mentorship, and leadership development."
    ]
  },
  {
    id: 'treasurer',
    role: 'Treasurer',
    name: 'Dr. Avi Singh, MD',
    school: 'Emory University',
    year: 'Neurology Resident',
    icon: <Heart className="w-6 h-6" />,
    bio: [
      "I'm Dr. Avi Singh Gandh, a neurology resident at Emory University and an international medical graduate from India.",
      "I'm deeply passionate about mentorship and believe in the power of sharing one's journey to support and uplift others. Over the years, I've guided thousands of medical students and residents across the U.S. and India through my platform and YouTube channel, Medically Mediocre - built on the belief that while we are all born mediocre in totality, with our own unique traits, we all have the potential to become extraordinary through intention, initiative, and the right guidance.",
      "Beyond clinical medicine, I'm an award-winning medical poet writing across 4 languages including English, Hindi and Punjabi. I enjoy designing medical quizzes that connect education with entertainment and have a special interest in integrating creativity into medical education.",
      "I'm also an avid traveler, having explored over 20 countries, and I believe travel is one of the greatest forms of education. Joining the GAPI MSRF family is a privilege, and I'm excited to contribute meaningfully to its mission. I believe in living life fully while pursuing our professional dreams and always finding ways to give back to the community that shapes us."
    ]
  }
]; 