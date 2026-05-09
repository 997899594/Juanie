'use client';

import { createContext, useContext } from 'react';
import type { TeamRole } from '@/lib/db/schema';

interface ProjectContextValue {
  projectId: string;
  projectName: string;
  teamRole: TeamRole;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  projectId,
  projectName,
  teamRole,
  children,
}: ProjectContextValue & { children: React.ReactNode }) {
  return (
    <ProjectContext.Provider value={{ projectId, projectName, teamRole }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  return useContext(ProjectContext);
}
