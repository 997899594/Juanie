import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { buildObservabilityGovernanceSnapshot } from '@/lib/observability/governance-view';

export interface ObservabilityEnvironmentOption {
  id: string;
  name: string;
  namespace: string | null;
}

export interface ObservabilityPageData {
  project: {
    id: string;
    name: string;
  };
  environments: ObservabilityEnvironmentOption[];
  governance: ReturnType<typeof buildObservabilityGovernanceSnapshot>;
}

export async function getProjectObservabilityPageData(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      name: true,
      teamId: true,
    },
  });

  if (!project) {
    return null;
  }

  const [member, projectEnvironments] = await Promise.all([
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
    }),
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      columns: {
        id: true,
        name: true,
        namespace: true,
      },
    }),
  ]);

  if (!member) {
    return null;
  }

  return {
    project: {
      id: project.id,
      name: project.name,
    },
    environments: projectEnvironments,
    governance: buildObservabilityGovernanceSnapshot(member.role),
  } satisfies ObservabilityPageData;
}
