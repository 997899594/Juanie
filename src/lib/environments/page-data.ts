import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, releases, type TeamRole } from '@/lib/db/schema';
import {
  buildEnvironmentManageActionSnapshot,
  buildEnvironmentPageGovernanceSnapshot,
  buildPreviewEnvironmentActionSnapshot,
} from '@/lib/environments/governance-view';
import { decorateEnvironmentList } from '@/lib/environments/view';

export function buildProjectEnvironmentListData<
  TEnvironment extends Parameters<typeof decorateEnvironmentList>[0][number],
>(environments: TEnvironment[], role: TeamRole) {
  return decorateEnvironmentList(environments).map((environment) => ({
    ...environment,
    actions: {
      ...buildEnvironmentManageActionSnapshot(role, environment),
      ...(environment.isPreview ? buildPreviewEnvironmentActionSnapshot(role) : {}),
    },
  }));
}

export async function getProjectEnvironmentListData(projectId: string, role: TeamRole) {
  const [environmentList, releaseList] = await Promise.all([
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        domains: {
          with: {
            service: true,
          },
        },
        databases: {
          columns: {
            id: true,
            name: true,
            status: true,
            sourceDatabaseId: true,
          },
        },
      },
    }),
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      with: {
        environment: true,
      },
    }),
  ]);

  const latestReleaseByEnvironment = new Map<string, (typeof releaseList)[number]>();

  for (const release of releaseList) {
    if (!latestReleaseByEnvironment.has(release.environmentId)) {
      latestReleaseByEnvironment.set(release.environmentId, release);
    }
  }

  return {
    governance: buildEnvironmentPageGovernanceSnapshot(role),
    environments: buildProjectEnvironmentListData(
      environmentList.map((environment) => ({
        ...environment,
        latestRelease: latestReleaseByEnvironment.get(environment.id) ?? null,
      })),
      role
    ),
  };
}
