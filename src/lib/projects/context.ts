import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';

export interface ProjectRepositoryContext {
  project: typeof projects.$inferSelect;
  repository: typeof repositories.$inferSelect;
}

export function getRepositoryDefaultBranch(
  input:
    | {
        defaultBranch?: string | null;
      }
    | null
    | undefined
): string {
  const branch = input?.defaultBranch?.trim();
  return branch && branch.length > 0 ? branch : 'main';
}

export function getProjectProductionBranch(
  input:
    | {
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  const branch = input?.productionBranch?.trim();
  return branch && branch.length > 0 ? branch : getRepositoryDefaultBranch(input?.repository);
}

export function buildBranchHeadRef(branch: string): string {
  const normalized = branch.trim();
  return normalized.startsWith('refs/heads/') ? normalized : `refs/heads/${normalized}`;
}

export function getProjectProductionRef(
  input:
    | {
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  return buildBranchHeadRef(getProjectProductionBranch(input));
}

export function getProjectSourceRef(
  input:
    | {
        branch?: string | null;
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  const branch = input?.branch?.trim();
  return branch ? buildBranchHeadRef(branch) : getProjectProductionRef(input);
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
