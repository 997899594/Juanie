import { eq } from 'drizzle-orm';
import { getProjectWithRepositoryAccessOrNull } from '@/lib/api/page-access';
import { db } from '@/lib/db';
import { databases, environments, teams } from '@/lib/db/schema';
import { buildEnvironmentManageActionSnapshot } from '@/lib/environments/governance-view';
import {
  getEnvironmentKind,
  isPreviewEnvironment,
  isProductionEnvironment,
} from '@/lib/environments/model';
import { getProjectProductionBranch } from '@/lib/projects/refs';
import { resolveProjectRuntimeStatus } from '@/lib/projects/runtime-status';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

export async function getProjectSettingsPageData(projectId: string, userId: string) {
  const access = await getProjectWithRepositoryAccessOrNull(projectId, userId);
  if (!access) {
    return null;
  }

  const [team, environmentList, projectDatabases] = await Promise.all([
    db.query.teams.findFirst({
      where: eq(teams.id, access.project.teamId),
    }),
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
    }),
    db.query.databases.findMany({
      where: eq(databases.projectId, projectId),
      orderBy: (database, { asc }) => [asc(database.createdAt)],
    }),
  ]);

  const governance = buildProjectGovernanceSnapshot({
    role: access.member.role,
    environments: environmentList,
  });
  const runtimeStatus = resolveProjectRuntimeStatus({
    status: access.project.status,
    environments: environmentList,
  });

  return {
    project: {
      id: access.project.id,
      name: access.project.name,
      slug: access.project.slug,
      description: access.project.description,
      repositoryFullName: access.project.repository?.fullName ?? null,
      repositoryWebUrl: access.project.repository?.webUrl ?? null,
      productionBranch: getProjectProductionBranch(access.project),
      status: runtimeStatus.status ?? 'initializing',
      statusLabel: runtimeStatus.statusLabel,
      statusMessage: access.project.statusMessage ?? runtimeStatus.summary ?? null,
      teamName: team?.name ?? '团队',
      teamSlug: team?.slug ?? '',
      yourRole: access.member.role,
      governance,
      databases: projectDatabases.map((database) => ({
        id: database.id,
        name: database.name,
        type: database.type,
        plan: database.plan,
        provisionType: database.provisionType,
        environmentId: database.environmentId,
        serviceId: database.serviceId,
        capabilities: database.capabilities ?? [],
      })),
      environments: environmentList.map((environment) => ({
        id: environment.id,
        name: environment.name,
        kind: getEnvironmentKind(environment),
        isProduction: isProductionEnvironment(environment),
        isPreview: isPreviewEnvironment(environment),
        deploymentStrategy: environment.deploymentStrategy,
        databaseStrategy: environment.databaseStrategy,
        actions: buildEnvironmentManageActionSnapshot(access.member.role, environment),
      })),
    },
    overview: {
      headerDescription: `${team?.name ?? '团队'} · ${runtimeStatus.statusLabel}`,
      stats: [
        { label: '团队', value: team?.name ?? '—' },
        { label: '角色', value: governance.roleLabel },
        { label: '状态', value: runtimeStatus.statusLabel },
      ],
    },
  };
}
