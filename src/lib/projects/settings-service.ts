import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects, teamMembers, teams } from '@/lib/db/schema';
import { buildEnvironmentManageActionSnapshot } from '@/lib/environments/governance-view';
import {
  getEnvironmentKind,
  isPreviewEnvironment,
  isProductionEnvironment,
} from '@/lib/environments/model';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

export async function getProjectSettingsPageData(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  if (!project) {
    return null;
  }

  const [teamMember, team, environmentList] = await Promise.all([
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
    }),
    db.query.teams.findFirst({
      where: eq(teams.id, project.teamId),
    }),
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
    }),
  ]);

  if (!teamMember) {
    return null;
  }

  const governance = buildProjectGovernanceSnapshot({
    role: teamMember.role,
    environments: environmentList,
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      repositoryFullName: project.repository?.fullName ?? null,
      repositoryWebUrl: project.repository?.webUrl ?? null,
      productionBranch: project.productionBranch ?? 'main',
      status: project.status ?? 'initializing',
      statusMessage: project.statusMessage ?? null,
      teamName: team?.name ?? '团队',
      teamSlug: team?.slug ?? '',
      yourRole: teamMember.role,
      governance,
      environments: environmentList.map((environment) => ({
        id: environment.id,
        name: environment.name,
        kind: getEnvironmentKind(environment),
        isProduction: isProductionEnvironment(environment),
        isPreview: isPreviewEnvironment(environment),
        deploymentStrategy: environment.deploymentStrategy,
        databaseStrategy: environment.databaseStrategy,
        actions: buildEnvironmentManageActionSnapshot(teamMember.role, environment),
      })),
    },
    overview: {
      headerDescription: `${team?.name ?? '团队'} · ${project.status ?? 'active'}`,
      stats: [
        { label: '团队', value: team?.name ?? '—' },
        { label: '角色', value: governance.roleLabel },
        { label: '状态', value: project.status ?? '—' },
      ],
    },
  };
}
