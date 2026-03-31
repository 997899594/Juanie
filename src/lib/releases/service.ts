import { desc, eq } from 'drizzle-orm';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import { listLatestAIPluginSnapshotsByResourceIds } from '@/lib/ai/runtime/snapshot-service';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { db } from '@/lib/db';
import { environments, projects, releases, type TeamRole } from '@/lib/db/schema';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import {
  buildReleaseEnvironmentActionSnapshot,
  buildReleasePageGovernanceSnapshot,
} from '@/lib/releases/governance-view';
import { buildPromotionPlan } from '@/lib/releases/planning';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseOperationalContext } from '@/lib/releases/runtime-context';
import {
  buildReleaseListStats,
  decorateReleaseDetail,
  decorateReleaseList,
  filterReleaseCards,
  normalizeReleaseRiskFilterState,
} from '@/lib/releases/view';

export function buildProjectReleaseListData<
  TRelease extends Parameters<typeof decorateReleaseList>[0][number],
>(
  releases: TRelease[],
  aiReleasePlans?: Map<
    string,
    {
      summary: string;
      strategy: ReleasePlan['recommendation']['strategy'];
      riskLevel: ReleasePlan['risk']['level'];
      confidence: ReleasePlan['recommendation']['confidence'];
      generatedAt: string;
    }
  >
) {
  return decorateReleaseList(releases).map((release) => ({
    ...release,
    aiReleasePlan: aiReleasePlans?.get(release.id) ?? null,
  }));
}

export async function getProjectReleaseListData(projectId: string) {
  const [project, releaseList] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: {
        id: true,
        teamId: true,
      },
      with: {
        repository: {
          columns: {
            fullName: true,
            providerId: true,
          },
        },
      },
    }),
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      with: {
        environment: {
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
        },
        artifacts: {
          with: {
            service: true,
          },
        },
        deployments: {
          with: {
            service: true,
          },
        },
        migrationRuns: {
          with: {
            service: true,
            database: true,
            specification: true,
          },
        },
      },
    }),
  ]);

  const previewReviewMetadataById = project
    ? await buildPreviewReviewMetadataByItemId({
        projects: [project],
        items: releaseList.map((release) => ({
          id: release.id,
          projectId: release.projectId,
          sourceRef: release.sourceRef,
          environment: release.environment,
        })),
      })
    : new Map();

  const aiReleasePlans = project
    ? await listLatestAIPluginSnapshotsByResourceIds<ReleasePlan>({
        pluginId: 'release-intelligence',
        teamId: project.teamId,
        resourceType: 'release',
        resourceIds: releaseList.map((release) => release.id),
      }).then((snapshotMap) => {
        const result = new Map<
          string,
          {
            summary: string;
            strategy: ReleasePlan['recommendation']['strategy'];
            riskLevel: ReleasePlan['risk']['level'];
            confidence: ReleasePlan['recommendation']['confidence'];
            generatedAt: string;
          }
        >();

        for (const [releaseId, snapshot] of snapshotMap) {
          const output = snapshot.output;
          result.set(releaseId, {
            summary: output.recommendation.summary,
            strategy: output.recommendation.strategy,
            riskLevel: output.risk.level,
            confidence: output.recommendation.confidence,
            generatedAt: snapshot.generatedAt,
          });
        }

        return result;
      })
    : new Map();

  return buildProjectReleaseListData(
    releaseList.map((release) => ({
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
    })),
    aiReleasePlans
  );
}

export function buildProjectReleasesPageData<
  TRelease extends ReturnType<typeof buildProjectReleaseListData>[number] & {
    status: string;
    environment: {
      id: string;
      name?: string;
      isProduction?: boolean | null;
    };
  },
  TEnvironment extends {
    id: string;
    name: string;
    autoDeploy: boolean;
    isProduction: boolean;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
  },
  TPromotePlan,
  TPromoteAI,
>(input: {
  releases: TRelease[];
  environments: TEnvironment[];
  role: TeamRole;
  promotePlan: TPromotePlan | null;
  promoteAI?: TPromoteAI | null;
  envFilter?: string | null;
  riskFilter?: string | null;
}) {
  const governance = buildReleasePageGovernanceSnapshot({
    role: input.role,
    environments: input.environments,
  });
  const releases = input.releases.map((release) => ({
    ...release,
    actions: buildReleaseEnvironmentActionSnapshot(input.role, release.environment),
  }));
  const selectedEnv = input.envFilter && input.envFilter.length > 0 ? input.envFilter : 'all';
  const selectedRisk = normalizeReleaseRiskFilterState(input.riskFilter);
  const filteredReleases = filterReleaseCards(releases, {
    env: selectedEnv,
    risk: selectedRisk,
  });

  return {
    releases,
    filteredReleases,
    environments: input.environments,
    governance,
    environmentOptions: [
      'all',
      ...new Set(releases.map((release) => release.environment.name ?? '环境')),
    ],
    selectedEnv,
    selectedRisk,
    stats: [...buildReleaseListStats(filteredReleases), { label: '实时', value: '离线' as const }],
    promotePlan: input.promotePlan,
    promoteAI: input.promoteAI ?? null,
    hasStagingProdSplit: input.environments.some((environment) => environment.isProduction),
  };
}

export async function getProjectReleasesPageData(input: {
  projectId: string;
  role: TeamRole;
  envFilter?: string | null;
  riskFilter?: string | null;
}) {
  const [project, releaseCards, environmentList, promotePlan] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
      columns: {
        teamId: true,
      },
    }),
    getProjectReleaseListData(input.projectId),
    db.query.environments.findMany({
      where: eq(environments.projectId, input.projectId),
      orderBy: [environments.createdAt],
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
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
    buildPromotionPlan(input.projectId).catch(() => null),
  ]);

  const stagingRelease = releaseCards.find(
    (release) =>
      release.environment.isProduction !== true &&
      release.environment.isPreview !== true &&
      release.status === 'succeeded' &&
      release.artifacts.length > 0
  );

  const promoteAI =
    project && stagingRelease
      ? await resolveAIPluginSnapshot<ReleasePlan>({
          pluginId: 'release-intelligence',
          context: {
            teamId: project.teamId,
            projectId: input.projectId,
            environmentId: stagingRelease.environment.id,
            releaseId: stagingRelease.id,
          },
        }).then((snapshot) => {
          const output = snapshot.snapshot?.output ?? null;

          return output
            ? {
                summary: output.recommendation.summary,
                strategy: output.recommendation.strategy,
                confidence: output.recommendation.confidence,
                riskLevel: output.risk.level,
                reasons: output.recommendation.why.slice(0, 3),
                checks: output.checks.slice(0, 3).map((check) => ({
                  key: check.key,
                  label: check.label,
                  status: check.status,
                  summary: check.summary,
                })),
                stale: snapshot.stale,
                source: snapshot.source,
                generatedAt: snapshot.snapshot?.generatedAt ?? null,
                errorMessage: snapshot.errorMessage,
              }
            : {
                summary: null,
                strategy: null,
                confidence: null,
                riskLevel: null,
                reasons: [],
                checks: [],
                stale: snapshot.stale,
                source: snapshot.source,
                generatedAt: null,
                errorMessage: snapshot.errorMessage ?? snapshot.availability.blockedReason,
              };
        })
      : null;

  return buildProjectReleasesPageData({
    releases: releaseCards,
    environments: environmentList,
    role: input.role,
    promotePlan,
    promoteAI,
    envFilter: input.envFilter,
    riskFilter: input.riskFilter,
  });
}

export function buildReleaseDetailPageData<
  TRelease extends Parameters<typeof decorateReleaseDetail>[0] & {
    projectId: string;
    environmentId: string;
    createdAt: Date;
  },
  TPreviousRelease extends
    | (Parameters<typeof decorateReleaseDetail>[1] & {
        id: string;
        summary?: string | null;
        sourceRef?: string | null;
        sourceCommitSha?: string | null;
        environment?: {
          isPreview?: boolean | null;
        } | null;
      })
    | null,
>(input: { projectId: string; release: TRelease; previousRelease: TPreviousRelease }) {
  if (input.release.projectId !== input.projectId) {
    return null;
  }

  return {
    release: decorateReleaseDetail(input.release, input.previousRelease ?? null),
    previousReleaseLink: input.previousRelease
      ? {
          id: input.previousRelease.id,
          title: getReleaseDisplayTitle(input.previousRelease),
        }
      : null,
  };
}

export async function getReleaseDetailPageData(input: { projectId: string; releaseId: string }) {
  const release = await getReleaseById(input.releaseId);
  if (!release) {
    return null;
  }

  const [previousRelease, runtimeContext] = await Promise.all([
    getPreviousReleaseByScope({
      projectId: input.projectId,
      environmentId: release.environmentId,
      createdAt: release.createdAt,
    }),
    getReleaseOperationalContext({
      projectId: release.projectId,
      teamId: release.project.teamId,
      environmentId: release.environmentId,
      environmentName: release.environment.name,
      environmentIsPreview: release.environment.isPreview,
      namespace: release.environment.namespace,
      deploymentStrategy: release.environment.deploymentStrategy,
      releaseWindow: {
        startedAt: release.createdAt,
        finishedAt: release.updatedAt,
      },
    }),
  ]);

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: [
      {
        id: release.project.id,
        teamId: release.project.teamId,
        repository: release.project.repository
          ? {
              fullName: release.project.repository.fullName,
              providerId: release.project.repository.providerId,
            }
          : null,
      },
    ],
    items: [
      {
        id: release.id,
        projectId: release.projectId,
        sourceRef: release.sourceRef,
        environment: release.environment,
      },
      ...(previousRelease
        ? [
            {
              id: previousRelease.id,
              projectId: input.projectId,
              sourceRef: previousRelease.sourceRef,
              environment: null,
            },
          ]
        : []),
    ],
  });

  return buildReleaseDetailPageData({
    projectId: input.projectId,
    release: {
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
      infrastructureDiagnostics: runtimeContext.infrastructureDiagnostics,
      governanceEvents: runtimeContext.governanceEvents,
    },
    previousRelease: previousRelease ?? null,
  });
}
