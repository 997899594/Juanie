import { eq } from 'drizzle-orm';
import { getProjectAccessOrNull } from '@/lib/api/page-access';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
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
  const access = await getProjectAccessOrNull(projectId, userId);
  if (!access) {
    return null;
  }

  const projectEnvironments = await db.query.environments.findMany({
    where: eq(environments.projectId, access.project.id),
    columns: {
      id: true,
      name: true,
      namespace: true,
    },
  });

  return {
    project: {
      id: access.project.id,
      name: access.project.name,
    },
    environments: projectEnvironments,
    governance: buildObservabilityGovernanceSnapshot(access.member.role),
  } satisfies ObservabilityPageData;
}
