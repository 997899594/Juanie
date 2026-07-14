import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type DeploymentStatus,
  environments,
  type PromotionFlowStrategy,
  projects,
  promotionFlows,
  type ReleaseStatus,
  releases,
  services,
} from '@/lib/db/schema';
import {
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentInheritancePresentation,
} from '@/lib/environments/presentation';
import {
  type PromotionFlowResolution,
  resolvePromotionFlow,
  resolvePromotionFlows,
} from '@/lib/environments/promotion';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import { evaluateEnvironmentPolicy, evaluateReleasePolicy } from '@/lib/policies/delivery';
import { requireProjectRepositoryContext } from '@/lib/projects/context';
import type { ReleaseServiceInput } from '@/lib/releases';
import {
  canCreateReleaseWithEntryPoint,
  getReleaseEntryPointGuardReason,
  type ReleaseEntryPoint,
} from '@/lib/releases/admission';
import { getDeployableReleaseArtifacts, getReleaseArtifactUri } from '@/lib/releases/artifacts';
import {
  type EnvironmentRollbackCandidate,
  type PlanningEnvironmentLike,
  type PromotionPlanningOptions,
  type PromotionPlanSnapshot,
  type ReleasePlanningSnapshot,
} from '@/lib/releases/planning-types';
import { resolvePlanningServices, summarizeReleasePlan } from '@/lib/releases/release-plan-summary';
import { getStoredReleaseSchemaGate } from '@/lib/schema-safety';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

export type {
  EnvironmentRollbackCandidate,
  PromotionPlanSnapshot,
  ReleasePlanningSnapshot,
} from '@/lib/releases/planning-types';
export { summarizeReleasePlan } from '@/lib/releases/release-plan-summary';

const retryableDuplicatePromotionStatuses = [
  'migration_pre_failed',
  'verification_failed',
  'degraded',
  'failed',
  'canceled',
] as const satisfies ReleaseStatus[];

function getReleaseStatusLabel(status: ReleaseStatus): string {
  const labels: Record<ReleaseStatus, string> = {
    admission_running: '准入检查',
    admission_failed: '准入失败',
    queued: '排队中',
    planning: '规划中',
    migration_pre_running: '前置迁移中',
    awaiting_approval: '等待审批',
    awaiting_external_completion: '等待外部完成',
    migration_pre_failed: '前置迁移失败',
    deploying: '部署中',
    awaiting_rollout: '等待放量',
    verifying: '校验中',
    verification_failed: '校验失败',
    migration_post_running: '后置迁移中',
    degraded: '降级',
    succeeded: '成功',
    failed: '失败',
    canceled: '已取消',
  };

  return labels[status] ?? status;
}

function getDeploymentStatusLabel(status: DeploymentStatus): string {
  const labels: Record<DeploymentStatus, string> = {
    queued: '排队中',
    migration_pending: '等待迁移',
    migration_running: '迁移中',
    migration_failed: '迁移失败',
    building: '构建中',
    deploying: '部署中',
    awaiting_rollout: '等待放量',
    verification_failed: '校验失败',
    running: '运行中',
    canceled: '已取消',
    failed: '失败',
    rolled_back: '已回滚',
  };

  return labels[status] ?? status;
}

export function getPromotionSourceBlockingReason(input: {
  sourceEnvironmentName: string;
  latestRelease: { status: ReleaseStatus; sourceCommitSha: string | null } | null;
  deployableArtifactCount: number;
  deploymentStatuses: DeploymentStatus[];
}): string | null {
  if (!input.latestRelease) {
    return `${input.sourceEnvironmentName} 暂无可提升的发布，请先发布并验证通过`;
  }

  if (input.latestRelease.status !== 'succeeded') {
    const commitLabel = input.latestRelease.sourceCommitSha?.slice(0, 7) ?? '最新版本';
    return `${input.sourceEnvironmentName} 最新发布 ${commitLabel} 当前状态为${getReleaseStatusLabel(input.latestRelease.status)}，不能提升历史成功版本`;
  }

  if (input.deployableArtifactCount === 0) {
    return `${input.sourceEnvironmentName} 最新成功发布缺少可复用制品，请先重新发布`;
  }

  const nonRunningDeploymentStatus = input.deploymentStatuses.find(
    (status) => status !== 'running'
  );
  if (nonRunningDeploymentStatus) {
    return `${input.sourceEnvironmentName} 最新成功发布仍有服务未运行：${getDeploymentStatusLabel(nonRunningDeploymentStatus)}`;
  }

  if (input.deploymentStatuses.length === 0) {
    return `${input.sourceEnvironmentName} 最新成功发布缺少已验证的服务部署记录，请先重新发布`;
  }

  return null;
}

function isRetryableDuplicatePromotionStatus(status: ReleaseStatus): boolean {
  return retryableDuplicatePromotionStatuses.includes(
    status as (typeof retryableDuplicatePromotionStatuses)[number]
  );
}

export function getDuplicatePromotionBlockingReason(input: {
  sourceEnvironmentName: string;
  targetEnvironmentName: string;
  sourceReleaseId: string;
  sourceCommitSha: string | null;
  targetRelease: {
    sourceReleaseId: string | null;
    status: ReleaseStatus;
  } | null;
}): string | null {
  if (!input.targetRelease || input.targetRelease.sourceReleaseId !== input.sourceReleaseId) {
    return null;
  }

  if (isRetryableDuplicatePromotionStatus(input.targetRelease.status)) {
    return null;
  }

  const sourceLabel = input.sourceCommitSha?.slice(0, 7) ?? '当前版本';

  return `${input.sourceEnvironmentName} 的 ${sourceLabel} 已经提升到 ${input.targetEnvironmentName}（${getReleaseStatusLabel(input.targetRelease.status)}），无需重复提升`;
}

function buildStaticPlanningSnapshot(input: {
  canCreate: boolean;
  blockingReason: string | null;
  environment: PlanningEnvironmentLike;
  summary?: string | null;
}): ReleasePlanningSnapshot {
  const environmentPolicy = evaluateEnvironmentPolicy(input.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: input.environment,
    migrationRuns: [],
  });

  const environmentInheritance = getEnvironmentInheritancePresentation(input.environment);
  const environmentDatabaseStrategy = getEnvironmentDatabaseStrategyLabel(
    input.environment.databaseStrategy
  );

  return {
    canCreate: input.canCreate,
    blockingReason: input.blockingReason,
    services: [],
    environmentPolicy,
    releasePolicy,
    issue: null,
    platformSignals: buildPlatformSignalSnapshot({
      environmentPolicySignals: environmentPolicy.signals,
      environmentPolicySignal: environmentPolicy.primarySignal,
      releasePolicySignals: releasePolicy.signals,
      releasePolicySignal: releasePolicy.primarySignal,
    }),
    migration: {
      preDeployCount: 0,
      postDeployCount: 0,
      automaticCount: 0,
      manualPlatformCount: 0,
      externalCount: 0,
      warnings: [],
      signals: [],
      primarySignal: null,
      requiresApproval: false,
      requiresExternalCompletion: false,
    },
    schema: {
      checkedCount: 0,
      blockingCount: 0,
      states: [],
      summary: null,
      nextActionLabel: null,
      refresh: {
        requested: false,
        queuedCount: 0,
        runningCount: 0,
        unavailableCount: 0,
        failedCount: 0,
        missingCount: 0,
      },
    },
    environmentInheritance: environmentInheritance?.label ?? null,
    environmentDatabaseStrategy,
    summary: input.summary ?? environmentPolicy.summary ?? environmentInheritance?.summary ?? null,
  };
}

export async function buildProjectReleasePlan(input: {
  projectId: string;
  environmentId: string;
  services: ReleaseServiceInput[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  entryPoint?: ReleaseEntryPoint;
  requestSchemaRefresh?: boolean;
}): Promise<ReleasePlanningSnapshot> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      services: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, input.environmentId),
    with: {
      baseEnvironment: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!environment || environment.projectId !== project.id) {
    throw new Error(`Environment ${input.environmentId} not found`);
  }

  const entryPoint = input.entryPoint ?? 'manual_release';
  if (!canCreateReleaseWithEntryPoint(environment, entryPoint)) {
    return buildStaticPlanningSnapshot({
      canCreate: false,
      blockingReason: getReleaseEntryPointGuardReason(environment, entryPoint),
      environment,
    });
  }

  const plannedServices = resolvePlanningServices(project.id, project.services, input.services);
  const serviceIds = plannedServices.map((service) => service.id);
  const [preDeploySpecs, postDeploySpecs] = await Promise.all([
    resolveMigrationSpecifications(project.id, environment.id, 'preDeploy', {
      serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
    resolveMigrationSpecifications(project.id, environment.id, 'postDeploy', {
      serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
  ]);
  const schemaGate = await getStoredReleaseSchemaGate({
    projectId: project.id,
    environmentId: environment.id,
    serviceIds,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
    requestRefresh: input.requestSchemaRefresh,
  });

  return summarizeReleasePlan({
    environment,
    services: plannedServices,
    migrationSpecs: [...preDeploySpecs, ...postDeploySpecs],
    schemaGate,
  });
}

function buildStaticPromotionPlan(input: {
  sourceEnvironment?: PromotionPlanSnapshot['sourceEnvironment'];
  targetEnvironment?: PromotionPlanSnapshot['targetEnvironment'];
  sourceRelease?: PromotionPlanSnapshot['sourceRelease'];
  flowId?: string | null;
  strategy?: PromotionFlowStrategy | null;
  requiresApproval?: boolean;
  isAlreadyPromoted?: boolean;
  blockingReason: string;
  environment?: PlanningEnvironmentLike;
}): PromotionPlanSnapshot {
  return {
    flowId: input.flowId ?? null,
    strategy: input.strategy ?? null,
    requiresApproval: input.requiresApproval ?? false,
    isAlreadyPromoted: input.isAlreadyPromoted ?? false,
    sourceRelease: input.sourceRelease ?? null,
    sourceEnvironment: input.sourceEnvironment ?? null,
    targetEnvironment: input.targetEnvironment ?? null,
    plan: buildStaticPlanningSnapshot({
      canCreate: false,
      blockingReason: input.blockingReason,
      environment: input.environment ?? input.targetEnvironment ?? { isProduction: false },
    }),
  };
}

export async function resolveDuplicatePromotion(input: {
  projectId: string;
  targetEnvironmentId: string;
  targetEnvironmentName: string;
  sourceEnvironmentName: string;
  sourceReleaseId: string;
  sourceCommitSha: string | null;
}): Promise<{
  latestTargetRelease: {
    id: string;
    sourceReleaseId: string | null;
    status: ReleaseStatus;
  } | null;
  blockingReason: string | null;
}> {
  const latestTargetRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, input.projectId),
      eq(releases.environmentId, input.targetEnvironmentId)
    ),
    orderBy: [desc(releases.createdAt)],
    columns: {
      id: true,
      sourceReleaseId: true,
      status: true,
    },
  });

  return {
    latestTargetRelease: latestTargetRelease ?? null,
    blockingReason: getDuplicatePromotionBlockingReason({
      sourceEnvironmentName: input.sourceEnvironmentName,
      targetEnvironmentName: input.targetEnvironmentName,
      sourceReleaseId: input.sourceReleaseId,
      sourceCommitSha: input.sourceCommitSha,
      targetRelease: latestTargetRelease ?? null,
    }),
  };
}

function toPromotionPlanEnvironment(
  environment: typeof environments.$inferSelect | null
): PromotionPlanSnapshot['targetEnvironment'] {
  if (!environment) {
    return null;
  }

  return {
    id: environment.id,
    name: environment.name,
    isProduction: environment.isProduction,
  };
}

export async function resolvePromotableSourceRelease(input: {
  projectId: string;
  sourceEnvironment: Pick<typeof environments.$inferSelect, 'id' | 'name'>;
}) {
  const latestRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, input.projectId),
      eq(releases.environmentId, input.sourceEnvironment.id)
    ),
    orderBy: [desc(releases.createdAt)],
    with: {
      artifacts: {
        with: {
          service: true,
        },
      },
      deployments: true,
    },
  });

  const sourceArtifacts = latestRelease
    ? getDeployableReleaseArtifacts(latestRelease.artifacts)
    : [];
  const blockingReason = getPromotionSourceBlockingReason({
    sourceEnvironmentName: input.sourceEnvironment.name,
    latestRelease: latestRelease
      ? {
          status: latestRelease.status,
          sourceCommitSha: latestRelease.sourceCommitSha,
        }
      : null,
    deployableArtifactCount: sourceArtifacts.length,
    deploymentStatuses: latestRelease?.deployments.map((deployment) => deployment.status) ?? [],
  });

  return {
    sourceRelease: blockingReason ? null : latestRelease,
    sourceArtifacts: blockingReason ? [] : sourceArtifacts,
    blockingReason,
  };
}

async function buildPromotionPlanForResolution(
  projectId: string,
  resolution: PromotionFlowResolution,
  options: PromotionPlanningOptions = {}
): Promise<PromotionPlanSnapshot> {
  const includeLiveChecks = options.includeLiveChecks ?? true;
  const sourceEnvironment = toPromotionPlanEnvironment(resolution.sourceEnvironment);
  const targetEnvironment = toPromotionPlanEnvironment(resolution.targetEnvironment);
  const strategy = resolution.flow?.strategy ?? 'reuse_release_artifacts';
  const requiresApproval =
    resolution.flow?.requiresApproval ?? Boolean(resolution.targetEnvironment?.isProduction);

  if (!resolution.targetEnvironment) {
    return buildStaticPromotionPlan({
      sourceEnvironment,
      flowId: resolution.flow?.id ?? null,
      strategy,
      requiresApproval,
      blockingReason: '没有可用的提升目标环境',
      environment: { isProduction: false },
    });
  }

  if (!resolution.sourceEnvironment) {
    return buildStaticPromotionPlan({
      targetEnvironment,
      flowId: resolution.flow?.id ?? null,
      strategy,
      requiresApproval,
      blockingReason: '没有可用的提升来源环境',
      environment: resolution.targetEnvironment,
    });
  }

  const promotionSource = await resolvePromotableSourceRelease({
    projectId,
    sourceEnvironment: resolution.sourceEnvironment,
  });

  if (!promotionSource.sourceRelease) {
    return buildStaticPromotionPlan({
      sourceEnvironment,
      targetEnvironment,
      flowId: resolution.flow?.id ?? null,
      strategy,
      requiresApproval,
      blockingReason:
        promotionSource.blockingReason ??
        `${resolution.sourceEnvironment.name} 暂无可复用的成功发布`,
      environment: resolution.targetEnvironment,
    });
  }

  const { sourceRelease, sourceArtifacts } = promotionSource;
  const duplicatePromotion = await resolveDuplicatePromotion({
    projectId,
    targetEnvironmentId: resolution.targetEnvironment.id,
    targetEnvironmentName: resolution.targetEnvironment.name,
    sourceEnvironmentName: resolution.sourceEnvironment.name,
    sourceReleaseId: sourceRelease.id,
    sourceCommitSha: sourceRelease.sourceCommitSha,
  });

  if (duplicatePromotion.blockingReason) {
    return buildStaticPromotionPlan({
      sourceEnvironment,
      targetEnvironment,
      sourceRelease: {
        id: sourceRelease.id,
        summary: sourceRelease.summary,
        sourceCommitSha: sourceRelease.sourceCommitSha,
      },
      flowId: resolution.flow?.id ?? null,
      strategy,
      requiresApproval,
      isAlreadyPromoted: true,
      blockingReason: duplicatePromotion.blockingReason,
      environment: resolution.targetEnvironment,
    });
  }

  const plan = includeLiveChecks
    ? await buildProjectReleasePlan({
        projectId,
        environmentId: resolution.targetEnvironment.id,
        services: sourceArtifacts.map((artifact) => ({
          id: artifact.serviceId ?? undefined,
          name: artifact.service?.name,
          image: getReleaseArtifactUri(artifact) ?? '',
          digest: artifact.imageDigest,
        })),
        sourceRef: sourceRelease.sourceRef,
        sourceCommitSha: sourceRelease.sourceCommitSha,
        entryPoint: 'promotion',
        requestSchemaRefresh: options.requestSchemaRefresh,
      })
    : buildStaticPlanningSnapshot({
        canCreate: true,
        blockingReason: null,
        environment: resolution.targetEnvironment,
        summary: '打开提升发布时读取最新门禁快照',
      });

  return {
    flowId: resolution.flow?.id ?? null,
    strategy,
    requiresApproval,
    isAlreadyPromoted: false,
    sourceRelease: {
      id: sourceRelease.id,
      summary: sourceRelease.summary,
      sourceCommitSha: sourceRelease.sourceCommitSha,
    },
    sourceEnvironment,
    targetEnvironment,
    plan,
  };
}

export async function buildPromotionPlan(
  projectId: string,
  input?: {
    flowId?: string | null;
  } & PromotionPlanningOptions
): Promise<PromotionPlanSnapshot> {
  await requireProjectRepositoryContext(projectId);

  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
  });
  const flowList = await db.query.promotionFlows.findMany({
    where: eq(promotionFlows.projectId, projectId),
  });
  const resolutions = resolvePromotionFlows({
    environments: envList,
    promotionFlows: flowList,
  });

  if (input?.flowId) {
    const resolution = resolvePromotionFlow({
      environments: envList,
      promotionFlows: flowList,
      flowId: input.flowId,
    });

    if (!resolution.flow) {
      return buildStaticPromotionPlan({
        flowId: input.flowId,
        blockingReason: '未找到对应的提升链路',
        environment: { isProduction: false },
      });
    }

    return buildPromotionPlanForResolution(projectId, resolution, input);
  }

  const resolution = resolutions[0] ?? null;

  if (!resolution) {
    return buildStaticPromotionPlan({
      blockingReason: '当前项目还没有配置环境提升链路',
      environment: { isProduction: false },
    });
  }

  return buildPromotionPlanForResolution(projectId, resolution, input);
}

export async function buildPromotionPlans(
  projectId: string,
  options: PromotionPlanningOptions = {}
): Promise<PromotionPlanSnapshot[]> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const [envList, flowList] = await Promise.all([
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
    }),
    db.query.promotionFlows.findMany({
      where: eq(promotionFlows.projectId, projectId),
    }),
  ]);
  const resolutions = resolvePromotionFlows({
    environments: envList,
    promotionFlows: flowList,
  });

  if (resolutions.length === 0) {
    return [];
  }

  return Promise.all(
    resolutions.map((resolution) => buildPromotionPlanForResolution(projectId, resolution, options))
  );
}

function buildRollbackCandidate<
  TRelease extends {
    id: string;
    status: ReleaseStatus;
    sourceRef: string;
    sourceCommitSha: string | null;
    configCommitSha: string | null;
    summary: string | null;
    createdAt: Date;
    artifacts: Array<{
      serviceId: string | null;
      service?: {
        id: string;
        name: string;
      } | null;
      imageDigest?: string | null;
    }>;
    deployments: Array<{
      status: DeploymentStatus;
    }>;
  },
>(release: TRelease, projectServiceIds: Set<string>): EnvironmentRollbackCandidate | null {
  if (release.status !== 'succeeded') {
    return null;
  }

  const artifacts = getDeployableReleaseArtifacts(release.artifacts)
    .map((artifact) => {
      if (!artifact.service || !artifact.serviceId) {
        return null;
      }

      const imageUrl = getReleaseArtifactUri(artifact);
      if (!imageUrl) {
        return null;
      }

      return {
        service: {
          id: artifact.service.id,
          name: artifact.service.name,
        },
        imageUrl,
        imageDigest: artifact.imageDigest ?? null,
      };
    })
    .filter(
      (
        artifact
      ): artifact is {
        service: { id: string; name: string };
        imageUrl: string;
        imageDigest: string | null;
      } => Boolean(artifact)
    );

  if (artifacts.length === 0) {
    return null;
  }

  const artifactServiceIds = new Set(artifacts.map((artifact) => artifact.service.id));
  const coversEveryProjectService =
    projectServiceIds.size === 0 ||
    Array.from(projectServiceIds).every((serviceId) => artifactServiceIds.has(serviceId));

  if (!coversEveryProjectService) {
    return null;
  }

  if (
    release.deployments.length === 0 ||
    release.deployments.some((deployment) => deployment.status !== 'running')
  ) {
    return null;
  }

  return {
    id: release.id,
    sourceRef: release.sourceRef,
    sourceCommitSha: release.sourceCommitSha ?? null,
    configCommitSha: release.configCommitSha ?? release.sourceCommitSha ?? null,
    summary: release.summary ?? null,
    createdAt: release.createdAt,
    artifacts,
  };
}

export async function buildEnvironmentRollbackPlan(input: {
  projectId: string;
  environmentId: string;
  sourceReleaseId?: string | null;
  requestSchemaRefresh?: boolean;
}): Promise<{
  sourceRelease: EnvironmentRollbackCandidate | null;
  candidates: EnvironmentRollbackCandidate[];
  currentRelease: {
    id: string;
    status: ReleaseStatus;
    commitSha: string | null;
  } | null;
  plan: ReleasePlanningSnapshot;
}> {
  const [environment, projectServices, releaseList] = await Promise.all([
    db.query.environments.findFirst({
      where: eq(environments.id, input.environmentId),
    }),
    db.query.services.findMany({
      where: eq(services.projectId, input.projectId),
      columns: {
        id: true,
      },
    }),
    db.query.releases.findMany({
      where: and(
        eq(releases.projectId, input.projectId),
        eq(releases.environmentId, input.environmentId)
      ),
      orderBy: [desc(releases.createdAt)],
      with: {
        artifacts: {
          with: {
            service: true,
          },
        },
        deployments: true,
      },
    }),
  ]);

  if (!environment || environment.projectId !== input.projectId) {
    return {
      sourceRelease: null,
      candidates: [],
      currentRelease: null,
      plan: buildStaticPlanningSnapshot({
        canCreate: false,
        blockingReason: 'Environment not found',
        environment: { isProduction: false },
        summary: null,
      }),
    };
  }

  const latestRelease = releaseList[0] ?? null;
  const latestSucceededReleaseId = latestRelease?.status === 'succeeded' ? latestRelease.id : null;
  const projectServiceIds = new Set(projectServices.map((service) => service.id));
  const candidates = releaseList
    .map((release) => buildRollbackCandidate(release, projectServiceIds))
    .filter((candidate): candidate is EnvironmentRollbackCandidate => Boolean(candidate))
    .filter((candidate) => candidate.id !== latestSucceededReleaseId);
  const sourceRelease = input.sourceReleaseId
    ? (candidates.find((candidate) => candidate.id === input.sourceReleaseId) ?? null)
    : (candidates[0] ?? null);

  if (!sourceRelease) {
    const blockingReason = input.sourceReleaseId
      ? '所选 release 不是可回滚的完整成功快照'
      : '当前环境没有可回滚的完整成功 release 快照';
    return {
      sourceRelease: null,
      candidates,
      currentRelease: latestRelease
        ? {
            id: latestRelease.id,
            status: latestRelease.status,
            commitSha: latestRelease.sourceCommitSha ?? null,
          }
        : null,
      plan: buildStaticPlanningSnapshot({
        canCreate: false,
        blockingReason,
        environment,
      }),
    };
  }

  const plan = await buildProjectReleasePlan({
    projectId: input.projectId,
    environmentId: input.environmentId,
    services: sourceRelease.artifacts.map((artifact) => ({
      id: artifact.service.id,
      name: artifact.service.name,
      image: artifact.imageUrl,
      digest: artifact.imageDigest,
    })),
    sourceRef: sourceRelease.sourceRef,
    sourceCommitSha: sourceRelease.sourceCommitSha,
    entryPoint: 'rollback',
    requestSchemaRefresh: input.requestSchemaRefresh,
  });

  return {
    sourceRelease,
    candidates,
    currentRelease: latestRelease
      ? {
          id: latestRelease.id,
          status: latestRelease.status,
          commitSha: latestRelease.sourceCommitSha ?? null,
        }
      : null,
    plan,
  };
}
