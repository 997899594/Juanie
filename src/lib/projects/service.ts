import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  databases,
  deployments,
  domains,
  environments,
  migrationRuns,
  projects,
  releases,
  services,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import { decorateEnvironmentList } from '@/lib/environments/view';
import { filterAttentionRuns, getAttentionStats } from '@/lib/migrations/attention';
import {
  buildProjectGovernanceSnapshot,
  type ProjectGovernanceCapability,
} from '@/lib/projects/settings-view';
import {
  buildProjectOverviewDetails,
  buildProjectOverviewStats,
  decorateProjectAttentionRuns,
  decorateProjectDatabaseCards,
  decorateProjectDomains,
  decorateProjectRecentReleases,
  decorateProjectServices,
  type ProjectAttentionRunLike,
  type ProjectDatabaseLike,
  type ProjectDeploymentLike,
  type ProjectDomainLike,
  type ProjectMigrationRunLike,
  type ProjectOverviewProjectLike,
  type ProjectReleaseLike,
  type ProjectServiceLike,
} from '@/lib/projects/view';

export function buildProjectOverviewPageData<
  TProject extends ProjectOverviewProjectLike & { name: string },
  TTeam extends { name?: string | null } | null | undefined,
  TService extends ProjectServiceLike,
  TDatabase extends ProjectDatabaseLike,
  TDomain extends ProjectDomainLike,
  TRelease extends ProjectReleaseLike,
  TMigrationRun extends ProjectAttentionRunLike & ProjectMigrationRunLike,
  TDeployment extends ProjectDeploymentLike,
>(input: {
  project: TProject;
  manualMigrationCapability?: ProjectGovernanceCapability | null;
  team: TTeam;
  projectEnvironments: Array<{
    id: string;
    name: string;
    baseEnvironment?: {
      id: string;
      name: string;
    } | null;
    databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }> | null;
    databases?: Array<{
      id: string;
      name: string;
      status?: string | null;
      sourceDatabaseId?: string | null;
    }> | null;
  }>;
  projectServices: TService[];
  projectDatabases: TDatabase[];
  projectDomains: TDomain[];
  recentReleases: TRelease[];
  recentMigrationRuns: TMigrationRun[];
  deploymentImageCandidates: TDeployment[];
}) {
  const attentionRuns = filterAttentionRuns(input.recentMigrationRuns);
  const attentionStats = getAttentionStats(attentionRuns);

  return {
    project: input.project,
    overview: buildProjectOverviewDetails(input.team?.name, input.project),
    stats: buildProjectOverviewStats({
      serviceCount: input.projectServices.length,
      databaseCount: input.projectDatabases.length,
      attentionCount: attentionStats.total,
      releaseCount: input.recentReleases.length,
    }),
    environmentCards: decorateEnvironmentList(
      input.projectEnvironments.map((environment) => {
        const latestRelease =
          input.recentReleases.find((release) => release.environment.id === environment.id) ?? null;

        return {
          ...environment,
          latestRelease: latestRelease
            ? {
                id: latestRelease.id,
                status: latestRelease.status ?? 'queued',
                summary: latestRelease.summary,
                sourceRef: latestRelease.sourceRef,
                sourceCommitSha: latestRelease.sourceCommitSha,
                createdAt: latestRelease.createdAt,
                environment: latestRelease.environment,
              }
            : null,
        };
      })
    ),
    serviceCards: decorateProjectServices(input.projectServices),
    domainCards: decorateProjectDomains(input.projectDomains),
    attentionItems: decorateProjectAttentionRuns(attentionRuns),
    databaseCards: decorateProjectDatabaseCards(input.projectDatabases, {
      services: input.projectServices,
      recentMigrationRuns: input.recentMigrationRuns,
      recentReleases: input.recentReleases,
      deploymentImageCandidates: input.deploymentImageCandidates,
      manualMigrationCapability: input.manualMigrationCapability,
    }),
    recentReleaseCards: decorateProjectRecentReleases(input.recentReleases),
  };
}

export type ProjectOverviewPageData = ReturnType<typeof buildProjectOverviewPageData>;

export async function getProjectOverviewPageData(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { repository: true },
  });

  if (!project) {
    return null;
  }

  const [
    team,
    member,
    projectEnvironments,
    projectServices,
    projectDatabases,
    projectDomains,
    recentReleases,
    recentMigrationRuns,
    deploymentImageCandidates,
  ] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }),
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
    }),
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        domains: true,
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
    db.query.services.findMany({ where: eq(services.projectId, projectId) }),
    db.query.databases.findMany({ where: eq(databases.projectId, projectId) }),
    db.query.domains.findMany({ where: eq(domains.projectId, projectId) }),
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      limit: 20,
      with: {
        environment: {
          with: {
            domains: true,
          },
        },
        artifacts: {
          with: {
            service: true,
          },
        },
      },
    }),
    db.query.migrationRuns.findMany({
      where: eq(migrationRuns.projectId, projectId),
      orderBy: (run, { desc }) => [desc(run.createdAt)],
      with: {
        database: true,
        environment: {
          with: {
            domains: true,
          },
        },
        service: true,
        release: true,
      },
    }),
    db.query.deployments.findMany({
      where: eq(deployments.projectId, projectId),
      orderBy: (deployment, { desc }) => [desc(deployment.createdAt)],
    }),
  ]);

  if (!member) {
    return null;
  }

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: [
      {
        id: project.id,
        teamId: project.teamId,
        repository: project.repository
          ? {
              fullName: project.repository.fullName,
              providerId: project.repository.providerId,
            }
          : null,
      },
    ],
    items: [
      ...recentReleases.map((release) => ({
        id: release.id,
        projectId: release.projectId,
        sourceRef: release.sourceRef,
        environment: release.environment,
      })),
      ...recentMigrationRuns.map((run) => ({
        id: run.id,
        projectId,
        sourceRef: run.release?.sourceRef ?? null,
        environment: run.environment,
      })),
    ],
  });

  return buildProjectOverviewPageData({
    project,
    manualMigrationCapability:
      buildProjectGovernanceSnapshot({
        role: member.role,
        environments: projectEnvironments,
      }).capabilities.find((item) => item.key === 'manual_migration') ?? null,
    team,
    projectEnvironments,
    projectServices,
    projectDatabases,
    projectDomains,
    recentReleases: recentReleases.map((release) => ({
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
    })),
    recentMigrationRuns: recentMigrationRuns.map((run) => ({
      ...run,
      previewReviewMetadata: previewReviewMetadataById.get(run.id) ?? null,
    })),
    deploymentImageCandidates,
  });
}
