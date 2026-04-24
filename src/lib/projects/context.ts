import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import { getRepositoryDefaultBranch } from '@/lib/projects/refs';

export interface ProjectRepositoryContext {
  project: typeof projects.$inferSelect;
  repository: typeof repositories.$inferSelect;
}

export async function getProjectRepositoryContext(
  projectId: string
): Promise<ProjectRepositoryContext | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  if (!project || !project.repositoryId || !project.repository) {
    return null;
  }

  return {
    project,
    repository: project.repository,
  };
}

export async function requireProjectRepositoryContext(
  projectId: string,
  messages?: {
    projectNotFound?: string;
    repositoryMissing?: string;
  }
): Promise<ProjectRepositoryContext> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  if (!project) {
    throw new Error(messages?.projectNotFound ?? 'Project not found');
  }

  if (!project.repositoryId || !project.repository) {
    throw new Error(messages?.repositoryMissing ?? 'Project has no repository');
  }

  return {
    project,
    repository: project.repository,
  };
}

export async function resolveProjectRepositoryDefaultBranch(
  projectId: string,
  branch?: string | null
): Promise<string> {
  if (branch) {
    return branch;
  }

  const context = await getProjectRepositoryContext(projectId);
  return getRepositoryDefaultBranch(context?.repository);
}
