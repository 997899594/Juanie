import { desc, eq } from 'drizzle-orm';
import { createMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import {
  listLatestAIPluginSnapshotsByResourceIds,
  type StoredAIPluginSnapshot,
} from '@/lib/ai/runtime/snapshot-service';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { db } from '@/lib/db';
import { environments, releases, type TeamRole } from '@/lib/db/schema';
import { isPreviewEnvironment, isProductionEnvironment } from '@/lib/environments/model';
import {
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import { buildMigrationFilePreviewByRunId } from '@/lib/migrations/file-preview';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import { buildReleasePageGovernanceSnapshot } from '@/lib/releases/governance-view';
import { buildPromotionPlans, type PromotionPlanSnapshot } from '@/lib/releases/planning';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseOperationalContext } from '@/lib/releases/runtime-context';
import {
  decorateReleaseDetail,
  decorateReleaseList,
  isReleaseAttentionCandidate,
  matchesReleaseRiskFilter,
  normalizeReleaseRiskFilterState,
} from '@/lib/releases/view';
import { isUuid } from '@/lib/uuid';

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

interface ProjectReleaseContext {
  id: string;
  teamId: string;
  repository?: {
    fullName: string;
    providerId: string;
  } | null;
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
            sourceConfigPath: run.specification.sourceConfigPath,
          }
        : null,
      database: run.database
        ? {
            id: run.database.id,
            type: run.database.type,
            connectionString: run.database.connectionString,
          }
        : null,
      status: run.status,
      release: {
        sourceRef: release.sourceRef,
        sourceCommitSha: run.sourceCommitSha ?? release.sourceCommitSha,
      },
      environment: {
        branch: release.environment.branch,
      },
    })),
    {
      executionStateMode: 'run_status',
    }
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

function attachReleaseApprovalTokens<TRelease extends Awaited<ReturnType<typeof getReleaseById>>>(
  release: TRelease,
  actorUserId?: string | null
) {
  if (!release || !actorUserId) {
    return release;
  }

  return {
    ...release,
    migrationRuns: release.migrationRuns.map((run) => ({
      ...run,
      approvalToken:
        run.status === 'awaiting_approval'
          ? createMigrationApprovalToken({
              teamId: release.project.teamId,
              projectId: release.projectId,
              environmentId: release.environmentId,
              runId: run.id,
              actorUserId,
            })
          : null,
    })),
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
      isProduction: isProductionEnvironment(release.environment),
      isPreview: isPreviewEnvironment(release.environment),
      scopeLabel: getEnvironmentScopeLabel(release.environment),
      sourceLabel: getEnvironmentSourceLabel(release.environment),
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
  const riskFilter = filters.risk ?? 'attention';

  return releases.filter((release) => {
    if (envFilter !== 'all' && release.environment.id !== envFilter) {
      return false;
    }

    return matchesReleaseRiskFilter(
      {
        status: release.status,
        approvalRunsCount: release.approvalRunsCount,
        failedMigrationRunsCount: release.failedMigrationRunsCount,
      },
      riskFilter
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
      value: releases.filter((release) =>
        isReleaseAttentionCandidate({
          status: release.status,
          approvalRunsCount: release.approvalRunsCount,
          failedMigrationRunsCount: release.failedMigrationRunsCount,
        })
      ).length,
    },
    {
      label: '失败',
      value: releases.filter((release) => release.failedMigrationRunsCount > 0).length,
    },
  ];
}

export async function getProjectReleaseListData(project: ProjectReleaseContext) {
  const releaseList = await db.query.releases.findMany({
    where: eq(releases.projectId, project.id),
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
  });

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: [
      {
        id: project.id,
        teamId: project.teamId,
        repository: project.repository ?? null,
      },
    ],
    items: releaseList.map((release) => ({
      id: release.id,
      projectId: release.projectId,
      sourceRef: release.sourceRef,
      environment: release.environment,
    })),
  });

  const aiReleasePlans = await listLatestAIPluginSnapshotsByResourceIds<ReleasePlan>({
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
  });

  return buildProjectReleaseListData(
    releaseList.map((release) => ({
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
    })),
    aiReleasePlans
  );
}

type PromotionAIView = {
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
};

type ProjectPromotionPlanView = PromotionPlanSnapshot & {
  ai: PromotionAIView | null;
};

function buildCachedPromotionAIView(
  snapshot: StoredAIPluginSnapshot<ReleasePlan> | null
): PromotionAIView | null {
  if (!snapshot) {
    return {
      summary: null,
      strategy: null,
      confidence: null,
      riskLevel: null,
      reasons: [],
      checks: [],
      stale: false,
      source: 'none',
      generatedAt: null,
      errorMessage: null,
    };
  }

  const output = snapshot.output;
  return {
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
    stale: true,
    source: 'cache',
    generatedAt: snapshot.generatedAt,
    errorMessage: null,
  };
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
    kind?: 'production' | 'persistent' | 'preview' | null;
    deliveryMode?: 'direct' | 'promote_only' | null;
    autoDeploy: boolean;
    isProduction: boolean;
    isPreview?: boolean | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    deliveryRules?: Array<{
      kind: 'branch' | 'tag' | 'pull_request' | 'manual';
      pattern: string | null;
      priority?: number | null;
    }>;
    scopeLabel?: string | null;
    sourceLabel?: string | null;
  }>;
  role: TeamRole;
  promotionPlans: ProjectPromotionPlanView[];
  envFilter?: string | null;
  riskFilter?: string | null;
  fixedEnvFilter?: boolean;
}) {
  const governance = buildReleasePageGovernanceSnapshot({
    role: input.role,
    environments: input.environments,
    promotionTargets: input.promotionPlans
      .map((plan) => plan.targetEnvironment)
      .filter((environment): environment is NonNullable<typeof environment> =>
        Boolean(environment)
      ),
  });
  const selectedEnv = input.envFilter && input.envFilter.length > 0 ? input.envFilter : 'all';
  const defaultRiskFilter = input.fixedEnvFilter ? 'all' : 'attention';
  const selectedRisk =
    input.riskFilter && input.riskFilter.length > 0
      ? normalizeReleaseRiskFilterState(input.riskFilter)
      : defaultRiskFilter;
  const filteredReleaseItems = filterLightweightReleaseItems(input.releaseItems, {
    env: selectedEnv,
    risk: selectedRisk,
  });
  const environmentOptions =
    input.fixedEnvFilter && selectedEnv !== 'all'
      ? input.environments
          .filter((environment) => environment.id === selectedEnv)
          .map((environment) => ({
            value: environment.id,
            label: environment.name ?? '环境',
          }))
      : input.environments.map((environment) => ({
          value: environment.id,
          label: environment.name ?? '环境',
        }));

  return {
    releaseItems: input.releaseItems,
    filteredReleaseItems,
    manualReleaseSources: input.manualReleaseSources,
    environments: input.environments,
    governance,
    environmentOptions: input.fixedEnvFilter
      ? environmentOptions
      : [{ value: 'all', label: '全部环境' }, ...environmentOptions],
    selectedEnv,
    selectedRisk,
    defaultRiskFilter,
    stats: [
      ...buildLightweightReleaseListStats(filteredReleaseItems),
      { label: '实时', value: '离线' as const },
    ],
    promotionPlans: input.promotionPlans,
    hasPromotionTarget: input.promotionPlans.length > 0,
  };
}

export async function getProjectReleasesPageData(input: {
  project: ProjectReleaseContext;
  role: TeamRole;
  envFilter?: string | null;
  riskFilter?: string | null;
  fixedEnvFilter?: boolean;
}) {
  const [releaseCards, environmentList, promotionPlansRaw] = await Promise.all([
    getProjectReleaseListData(input.project),
    db.query.environments.findMany({
      where: eq(environments.projectId, input.project.id),
      orderBy: [environments.createdAt],
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        deliveryRules: {
          columns: {
            kind: true,
            pattern: true,
            priority: true,
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
    buildPromotionPlans(input.project.id, { includeLiveChecks: false }).catch(() => []),
  ]);
  const promotionAISnapshots = await listLatestAIPluginSnapshotsByResourceIds<ReleasePlan>({
    pluginId: 'release-intelligence',
    teamId: input.project.teamId,
    resourceType: 'release',
    resourceIds: promotionPlansRaw
      .map((plan) => plan.sourceRelease?.id ?? null)
      .filter((releaseId): releaseId is string => Boolean(releaseId)),
  }).catch(() => new Map<string, StoredAIPluginSnapshot<ReleasePlan>>());
  const promotionPlans = promotionPlansRaw.map((plan) => ({
    ...plan,
    ai: plan.sourceRelease
      ? buildCachedPromotionAIView(promotionAISnapshots.get(plan.sourceRelease.id) ?? null)
      : null,
  }));

  return buildProjectReleasesPageData({
    releaseItems: buildProjectReleaseListItems(releaseCards),
    manualReleaseSources: buildManualReleaseSources(releaseCards),
    environments: environmentList.map((environment) => ({
      ...environment,
      scopeLabel: getEnvironmentScopeLabel(environment),
      sourceLabel: getEnvironmentSourceLabel(environment),
    })),
    role: input.role,
    promotionPlans,
    envFilter: input.envFilter,
    riskFilter: input.riskFilter,
    fixedEnvFilter: input.fixedEnvFilter,
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
          id: string;
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
    sourceReleaseLink: input.release.sourceRelease
      ? {
          id: input.release.sourceRelease.id,
          environmentId: input.release.sourceRelease.environment?.id ?? '',
          title: getReleaseDisplayTitle(input.release.sourceRelease),
          environmentName: input.release.sourceRelease.environment?.name ?? '来源环境',
        }
      : null,
    previousReleaseLink: input.previousRelease
      ? {
          id: input.previousRelease.id,
          environmentId: input.previousRelease.environment?.id ?? '',
          title: getReleaseDisplayTitle(input.previousRelease),
        }
      : null,
  };
}

export async function getReleaseDetailPageData(input: {
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
}) {
  if (!isUuid(input.projectId) || !isUuid(input.releaseId)) {
    return null;
  }

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
      environment: release.environment,
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
  const releaseWithApprovalTokens = attachReleaseApprovalTokens(
    releaseWithFilePreviews,
    input.actorUserId
  );

  return buildReleaseDetailPageData({
    projectId: input.projectId,
    release: {
      ...releaseWithApprovalTokens,
      previewReviewMetadata: previewReviewMetadataById.get(releaseWithApprovalTokens.id) ?? null,
      infrastructureDiagnostics: runtimeContext.infrastructureDiagnostics,
      governanceEvents: runtimeContext.governanceEvents,
    },
    previousRelease: previousRelease ?? null,
  });
}
