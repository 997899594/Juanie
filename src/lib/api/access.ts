import { and, eq } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { accessError } from '@/lib/api/errors';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  environments,
  projects,
  releases,
  services,
  type TeamRole,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { isUuid } from '@/lib/uuid';

const OWNER_ADMIN_ROLES: readonly TeamRole[] = ['owner', 'admin'];

export async function requireSession(): Promise<Session & { user: { id: string } }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw accessError('unauthorized', 'Unauthorized');
  }

  return session as Session & { user: { id: string } };
}

export async function getTeamAccessOrThrow(teamId: string, userId: string) {
  if (!isUuid(teamId)) {
    throw accessError('not_found', 'Team not found');
  }

  const [team, member] = await Promise.all([
    db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    }),
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    }),
  ]);

  if (!team) {
    throw accessError('not_found', 'Team not found');
  }

  if (!member) {
    throw accessError('forbidden', 'Forbidden');
  }

  return { team, member };
}

export async function getProjectAccessOrThrow(projectId: string, userId: string) {
  if (!isUuid(projectId)) {
    throw accessError('not_found', 'Project not found');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw accessError('not_found', 'Project not found');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    throw accessError('forbidden', 'Forbidden');
  }

  return { project, member };
}

export function hasTeamRole(
  role: TeamRole | null | undefined,
  allowedRoles: readonly TeamRole[]
): boolean {
  return Boolean(role && allowedRoles.includes(role));
}

export function isOwnerOrAdmin(role: TeamRole | null | undefined): boolean {
  return hasTeamRole(role, OWNER_ADMIN_ROLES);
}

export async function getProjectAccessWithRoleOrThrow(
  projectId: string,
  userId: string,
  allowedRoles: readonly TeamRole[],
  errorMessage = 'Forbidden'
) {
  const access = await getProjectAccessOrThrow(projectId, userId);

  if (!hasTeamRole(access.member.role, allowedRoles)) {
    throw accessError('forbidden', errorMessage);
  }

  return access;
}

export async function getProjectWithRepositoryAccessOrThrow(projectId: string, userId: string) {
  if (!isUuid(projectId)) {
    throw accessError('not_found', 'Project not found');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  if (!project) {
    throw accessError('not_found', 'Project not found');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    throw accessError('forbidden', 'Forbidden');
  }

  return { project, member };
}

export async function getProjectEnvironmentOrThrow(
  projectId: string,
  environmentId?: string | null
) {
  if (!isUuid(projectId)) {
    throw accessError('not_found', 'Project not found');
  }

  if (!environmentId) {
    const environment = await db.query.environments.findFirst({
      where: eq(environments.projectId, projectId),
      orderBy: (table, { desc, asc }) => [desc(table.isProduction), asc(table.createdAt)],
    });

    if (!environment) {
      throw accessError('not_found', 'Environment not found');
    }

    return environment;
  }

  if (!isUuid(environmentId)) {
    throw accessError('not_found', 'Environment not found');
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  });

  if (!environment) {
    throw accessError('not_found', 'Environment not found');
  }

  if (environment.projectId !== projectId) {
    throw accessError('invalid_scope', 'Environment does not belong to project');
  }

  return environment;
}

export async function getProjectServiceOrThrow(projectId: string, serviceId?: string | null) {
  if (!isUuid(projectId)) {
    throw accessError('not_found', 'Project not found');
  }

  if (!serviceId) {
    return null;
  }

  if (!isUuid(serviceId)) {
    throw accessError('not_found', 'Service not found');
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });

  if (!service) {
    throw accessError('not_found', 'Service not found');
  }

  if (service.projectId !== projectId) {
    throw accessError('invalid_scope', 'Service does not belong to project');
  }

  return service;
}

export async function getReleaseAccessOrThrow(releaseId: string, userId: string) {
  if (!isUuid(releaseId)) {
    throw accessError('not_found', 'Release not found');
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      project: true,
    },
  });

  if (!release) {
    throw accessError('not_found', 'Release not found');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, release.project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    throw accessError('forbidden', 'Forbidden');
  }

  return { release, project: release.project, member };
}
