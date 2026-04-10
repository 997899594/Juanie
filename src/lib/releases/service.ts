import { desc, eq } from 'drizzle-orm';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import { listLatestAIPluginSnapshotsByResourceIds } from '@/lib/ai/runtime/snapshot-service';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { db } from '@/lib/db';
import { environments, projects, releases, type TeamRole } from '@/lib/db/schema';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import { buildMigrationFilePreviewByRunId } from '@/lib/migrations/file-preview';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import { buildReleasePageGovernanceSnapshot } from '@/lib/releases/governance-view';
import { buildPromotionPlan } from '@/lib/releases/planning';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseOperationalContext } from '@/lib/releases/runtime-context';
import {
  decorateReleaseDetail,
  decorateReleaseList,
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

async function attachReleaseMigrationFilePreviews<
  TRelease extends Awaited<ReturnType<typeof getReleaseById>>,
>(release: TRelease) {
  if (!release) {
    return release;
  }

  const previewByRunId = await buildMigrationFilePreviewByRunId(
    release.migrationRuns.map((run) => ({
      id: run.id,
      projectId: release.projectId,
      specification: run.specification
        ? {
            tool: run.specification.tool,
            migrationPath: run.specification.migrationPath,
          }
        : null,
      database: run.database
        ? {
            id: run.database.id,
            type: run.database.type,
            connectionString: run.database.connectionString,
          }
        : null,
      release: {
        sourceRef: release.sourceRef,
        sourceCommitSha: run.sourceCommitSha ?? release.sourceCommitSha,
      },
      environment: {
        branch: release.environment.branch,
      },
    }))
  );

  return {
    ...release,
    migrationRuns: release.migrationRuns.map((run) => {
      const filePreview = previewByRunId.get(run.id);
      if (!filePreview || !run.specification) {
        return run;
      }

      return {
        ...run,
        specification: {
          ...run.specification,
          filePreview,
        },
      };
    }),
  };
}

function buildManualReleaseSources<
  TRelease extends ReturnType<typeof buildProjectReleaseListData>[number],
>(releases: TRelease[]) {
  return releases.map((release) => ({
    id: release.id,
    sourceRef: release.sourceRef ?? '',
    sourceCommitSha: release.sourceCommitSha ?? null,
    summary: release.recap?.primarySummary ?? null,
    artifacts: release.artifacts,
  }));
}

function buildProjectReleaseListItems<
  TRelease extends ReturnType<typeof buildProjectReleaseListData>[number],
>(releases: TRelease[]) {
  return releases.map((release) => ({
    id: release.id,
    displayTitle: release.displayTitle,
    status: release.status,
    statusDecoration: release.statusDecoration,
    riskLabel: release.riskLabel,
    sourceRef: release.sourceRef,
    sourceCommitSha: release.sourceCommitSha,
    createdAt: release.createdAt,
    recap: release.recap,
    approvalRunsCount: release.approvalRunsCount,
    failedMigrationRunsCount: release.failedMigrationRunsCount,
    previewSourceMeta: release.previewSourceMeta,
    platformSignals: release.platformSignals,
    primaryDomainUrl: release.primaryDomainUrl,
    environmentScope: release.environmentScope,
    environment: {
      id: release.environment.id,
      name: release.environment.name,
      isProduction: release.environment.isProduction,
      isPreview: release.environment.isPreview,
    },
    artifacts: release.artifacts.map((artifact) => ({
      id: artifact.id ?? `${release.id}-${artifact.service.id}`,
      imageUrl: artifact.imageUrl,
      service: artifact.service,
    })),
  }));
}

function filterLightweightReleaseItems(
  releases: ReturnType<typeof buildProjectReleaseListItems>,
  filters: {
    env?: string | null;
    risk?: ReturnType<typeof normalizeReleaseRiskFilterState>;
  }
) {
  const envFilter = filters.env && filters.env !== 'all' ? filters.env : 'all';
  const riskFilter = filters.risk ?? 'all';

  return releases.filter((release) => {
    if (envFilter !== 'all' && (release.environment.name ?? '环境') !== envFilter) {
      return false;
    }

    if (riskFilter === 'all') {
      return true;
    }

    if (riskFilter === 'attention') {
      return (
        release.approvalRunsCount > 0 ||
        release.failedMigrationRunsCount > 0 ||
        [
          'awaiting_external_completion',
          'migration_pre_failed',
          'failed',
          'degraded',
          'verification_failed',
        ].includes(release.status)
      );
    }

    if (riskFilter === 'approval') {
      return release.approvalRunsCount > 0;
    }

    return (
      release.failedMigrationRunsCount > 0 ||
      ['failed', 'migration_pre_failed', 'verification_failed'].includes(release.status)
    );
  });
}

function buildLightweightReleaseListStats(
  releases: ReturnType<typeof buildProjectReleaseListItems>
) {
  return [
    { label: '发布', value: releases.length },
    {
      label: '待处理',
      value: releases.filter((release) => release.approvalRunsCount > 0).length,
    },
    {
      label: '失败',
      value: releases.filter((release) => release.failedMigrationRunsCount > 0).length,
    },
  ];
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

export function buildProjectReleasesPageData(input: {
  releaseItems: ReturnType<typeof buildProjectReleaseListItems>;
  manualReleaseSources: Array<{
    id: string;
    sourceRef: string;
    sourceCommitSha: string | null;
    summary: string | null;
    artifacts: Array<{
      service: {
        id: string;
        name: string;
      };
      imageUrl: string;
      imageDigest?: string | null;
    }>;
  }>;
  environments: Array<{
    id: string;
    name: string;
    autoDeploy: boolean;
    isProduction: boolean;
    isPreview?: boolean | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
  }>;
  role: TeamRole;
  promotePlan: Awaited<ReturnType<typeof buildPromotionPlan>> | null;
  promoteAI?: {
    summary: string | null;
    strategy: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    confidence: 'low' | 'medium' | 'high' | null;
    riskLevel: 'low' | 'medium' | 'high' | null;
    reasons: string[];
    checks: Array<{
      key: string;
      label: string;
      status: 'pass' | 'warning' | 'blocked';
      summary: string;
    }>;
    stale: boolean;
    source: 'cache' | 'fresh' | 'none';
    generatedAt: string | null;
    errorMessage: string | null;
  } | null;
  envFilter?: string | null;
  riskFilter?: string | null;
}) {
  const governance = buildReleasePageGovernanceSnapshot({
    role: input.role,
    environments: input.environments,
  });
  const selectedEnv = input.envFilter && input.envFilter.length > 0 ? input.envFilter : 'all';
  const selectedRisk = normalizeReleaseRiskFilterState(input.riskFilter);
  const filteredReleaseItems = filterLightweightReleaseItems(input.releaseItems, {
    env: selectedEnv,
    risk: selectedRisk,
  });

  return {
    releaseItems: input.releaseItems,
    filteredReleaseItems,
    manualReleaseSources: input.manualReleaseSources,
    environments: input.environments,
    governance,
    environmentOptions: [
      'all',
      ...new Set(input.releaseItems.map((release) => release.environment.name ?? '环境')),
    ],
    selectedEnv,
    selectedRisk,
    stats: [
      ...buildLightweightReleaseListStats(filteredReleaseItems),
      { label: '实时', value: '离线' as const },
    ],
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
    releaseItems: buildProjectReleaseListItems(releaseCards),
    manualReleaseSources: buildManualReleaseSources(releaseCards),
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

  const releaseWithFilePreviews = await attachReleaseMigrationFilePreviews(release);

  return buildReleaseDetailPageData({
    projectId: input.projectId,
    release: {
      ...releaseWithFilePreviews,
      previewReviewMetadata: previewReviewMetadataById.get(releaseWithFilePreviews.id) ?? null,
      infrastructureDiagnostics: runtimeContext.infrastructureDiagnostics,
      governanceEvents: runtimeContext.governanceEvents,
    },
    previousRelease: previousRelease ?? null,
  });
}
