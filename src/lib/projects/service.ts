import { count, desc, eq } from 'drizzle-orm';
import { getProjectWithRepositoryAccessOrNull } from '@/lib/api/page-access';
import { db } from '@/lib/db';
import {
  databases,
  deployments,
  domains,
  environments,
  migrationRuns,
  releases,
  services,
  teamMembers,
  teams,
  users,
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
  resolveProjectRuntimeStatus,
} from '@/lib/projects/view';

interface ProjectCollaborationMemberInput {
  id: string;
  role: 'owner' | 'admin' | 'member';
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export function buildProjectOverviewPageData<
  TProject extends ProjectOverviewProjectLike & { name: string },
  TTeam extends { name?: string | null } | null | undefined,
  TService extends ProjectServiceLike,
  TDatabase extends ProjectDatabaseLike,
  TDomain extends ProjectDomainLike,
  TRelease extends ProjectReleaseLike,
  TMigrationRun extends ProjectAttentionRunLike & ProjectMigrationRunLike,
  TDeployment extends ProjectDeploymentLike,
  TMember extends ProjectCollaborationMemberInput,
>(input: {
  project: TProject;
  manualMigrationCapability?: ProjectGovernanceCapability | null;
  team: TTeam;
  teamMemberCount: number;
  teamMembersPreview: TMember[];
  projectEnvironments: Array<{
    id: string;
    name: string;
    baseEnvironment?: {
      id: string;
      name: string;
    } | null;
    deliveryMode?: 'direct' | 'promote_only' | null;
    databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    previewBuildStatus?: string | null;
    previewBuildSourceRef?: string | null;
    previewBuildSourceCommitSha?: string | null;
    previewBuildStartedAt?: Date | string | null;
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
  environmentTrackingReleases: Array<{
    id: string;
    environmentId: string;
    status: string;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    createdAt?: Date | string | null;
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
  const latestSuccessfulReleaseByEnvironment = new Map<
    string,
    (typeof input.environmentTrackingReleases)[number]
  >();

  for (const release of input.environmentTrackingReleases) {
    if (
      release.status === 'succeeded' &&
      !latestSuccessfulReleaseByEnvironment.has(release.environmentId)
    ) {
      latestSuccessfulReleaseByEnvironment.set(release.environmentId, release);
    }
  }

  const runtimeStatus = resolveProjectRuntimeStatus({
    status: input.project.status,
    environments: input.projectEnvironments,
  });

  return {
    project: input.project,
    overview: buildProjectOverviewDetails(input.team?.name, input.project, runtimeStatus),
    collaboration: {
      teamName: input.team?.name ?? null,
      memberCount: input.teamMemberCount,
      members: input.teamMembersPreview,
    },
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
        const latestSuccessfulRelease =
          latestSuccessfulReleaseByEnvironment.get(environment.id) ?? null;

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
          latestSuccessfulRelease: latestSuccessfulRelease
            ? {
                id: latestSuccessfulRelease.id,
                sourceRef: latestSuccessfulRelease.sourceRef,
                sourceCommitSha: latestSuccessfulRelease.sourceCommitSha,
                createdAt: latestSuccessfulRelease.createdAt,
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
  const access = await getProjectWithRepositoryAccessOrNull(projectId, userId);
  if (!access) {
    return null;
  }

  const project = access.project;
  const [
    team,
    teamMemberCountResult,
    teamMembersPreview,
    projectEnvironments,
    environmentTrackingReleases,
    projectServices,
    projectDatabases,
    projectDomains,
    recentReleases,
    recentMigrationRuns,
    deploymentImageCandidates,
  ] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }),
    db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, project.teamId)),
    db
      .select({
        id: teamMembers.id,
        role: teamMembers.role,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, project.teamId))
      .orderBy(teamMembers.createdAt)
      .limit(3),
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
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      columns: {
        id: true,
        environmentId: true,
        status: true,
        sourceRef: true,
        sourceCommitSha: true,
        createdAt: true,
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
        role: access.member.role,
        environments: projectEnvironments,
      }).capabilities.find((item) => item.key === 'manual_migration') ?? null,
    team,
    teamMemberCount: teamMemberCountResult[0]?.count ?? 0,
    teamMembersPreview,
    projectEnvironments,
    environmentTrackingReleases,
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
