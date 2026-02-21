import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { ProjectRole, TeamRole } from '@/lib/db/schema';
import { projectMembers, projects, teamMembers, teams } from '@/lib/db/schema';

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 4,
  maintainer: 3,
  developer: 2,
  viewer: 1,
};

export async function getUserTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)),
  });

  return member?.role ?? null;
}

export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)),
  });

  if (projectMember) {
    return projectMember.role;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return null;
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, project.teamId)),
  });

  return teamMember?.role === 'owner'
    ? 'owner'
    : teamMember?.role === 'admin'
      ? 'maintainer'
      : teamMember?.role === 'member'
        ? 'developer'
        : null;
}

export async function canManageTeam(userId: string, teamId: string): Promise<boolean> {
  const role = await getUserTeamRole(userId, teamId);
  return role === 'owner' || role === 'admin';
}

export async function canManageProject(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'owner' || role === 'maintainer';
}

export async function canDeployToProject(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'owner' || role === 'maintainer' || role === 'developer';
}

export async function canViewProject(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role !== null;
}

export async function canDeleteProject(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'owner';
}

export async function canManageProjectMembers(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'owner' || role === 'maintainer';
}

export function hasRolePermission(
  requiredRole: ProjectRole,
  userRole: ProjectRole | null
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
