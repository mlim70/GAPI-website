// frontend/src/components/students-residents/types.ts
import { ReactNode } from "react";

export interface TeamMember {
  id: string;
  role: string;
  name: string;
  school: string;
  year: string;
  icon: ReactNode;
  bio: string[];
} 