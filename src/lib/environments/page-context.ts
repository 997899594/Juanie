import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';

export async function getProjectMemberRole(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return null;
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    return null;
  }

  return {
    project,
    member,
  };
}

export async function getProjectEnvironmentOrNull(projectId: string, environmentId: string) {
  return db.query.environments.findFirst({
    where: and(eq(environments.id, environmentId), eq(environments.projectId, projectId)),
  });
}
