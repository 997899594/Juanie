import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deployments,
  type EnvironmentKind,
  environments,
  type PromotionFlowStrategy,
  projects,
  promotionFlows,
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
import { inspectResolvedMigrationSpecPendingState } from '@/lib/migrations/file-preview';
import {
  type EnvironmentPolicySnapshot,
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
  type MigrationPolicySignalSnapshot,
  type ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import { requireProjectRepositoryContext } from '@/lib/projects/context';
import { getProjectSourceRef } from '@/lib/projects/refs';
import type { ReleaseServiceInput } from '@/lib/releases';
import {
  canCreateReleaseWithEntryPoint,
  getReleaseEntryPointGuardReason,
  type ReleaseEntryPoint,
} from '@/lib/releases/admission';
import { buildIssueSnapshot, type ReleaseIssueSnapshot } from '@/lib/releases/intelligence';
import { inspectPreviewDatabaseGuard } from '@/lib/releases/preview-database-guard';
import { inspectReleaseSchemaGate, type ReleaseSchemaGateSnapshot } from '@/lib/schema-safety';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';

interface PlanningServiceLike {
  id: string;
  name: string;
  image: string;
  digest?: string | null;
}

interface PlanningMigrationSpecLike {
  specification: {
    phase: 'preDeploy' | 'postDeploy' | 'manual';
    executionMode: 'automatic' | 'manual_platform' | 'external';
    compatibility?: string | null;
    approvalPolicy?: string | null;
  };
  environment: {
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}

interface PlanningEnvironmentLike {
  id?: string;
  kind?: EnvironmentKind | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
}

export interface ReleasePlanningSnapshot {
  canCreate: boolean;
  blockingReason: string | null;
  services: PlanningServiceLike[];
  environmentPolicy: EnvironmentPolicySnapshot;
  releasePolicy: ReleasePolicySnapshot;
  issue: ReleaseIssueSnapshot | null;
  platformSignals: PlatformSignalSnapshot;
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    automaticCount: number;
    manualPlatformCount: number;
    externalCount: number;
    warnings: string[];
    signals: MigrationPolicySignalSnapshot[];
    primarySignal: MigrationPolicySignalSnapshot | null;
    requiresApproval: boolean;
    requiresExternalCompletion: boolean;
  };
  schema: {
    checkedCount: number;
    blockingCount: number;
    states: ReleaseSchemaGateSnapshot['states'];
    summary: string | null;
    nextActionLabel: string | null;
  };
  environmentInheritance: string | null;
  environmentDatabaseStrategy: string | null;
  summary: string | null;
}

export interface PromotionPlanSnapshot {
  flowId: string | null;
  strategy: PromotionFlowStrategy | null;
  requiresApproval: boolean;
  sourceRelease: {
    id: string;
    summary: string | null;
    sourceCommitSha: string | null;
  } | null;
  sourceEnvironment: {
    id: string;
    name: string;
    isProduction: boolean;
  } | null;
  targetEnvironment: {
    id: string;
    name: string;
    isProduction: boolean;
  } | null;
  plan: ReleasePlanningSnapshot;
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
    },
    environmentInheritance: environmentInheritance?.label ?? null,
    environmentDatabaseStrategy,
    summary: input.summary ?? environmentPolicy.summary ?? environmentInheritance?.summary ?? null,
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeMigrationSignals(
  signals: MigrationPolicySignalSnapshot[]
): MigrationPolicySignalSnapshot[] {
  const seen = new Set<string>();
  const result: MigrationPolicySignalSnapshot[] = [];

  for (const signal of signals) {
    if (seen.has(signal.code)) {
      continue;
    }
    seen.add(signal.code);
    result.push(signal);
  }

  return result;
}

function resolvePlanningServices(
  projectId: string,
  projectServices: Array<typeof services.$inferSelect>,
  inputs: ReleaseServiceInput[]
): PlanningServiceLike[] {
  if (inputs.length === 0) {
    throw new Error('At least one release service artifact is required');
  }

  if (inputs.length === 1 && !inputs[0]?.id && !inputs[0]?.name && projectServices.length > 1) {
    throw new Error(
      'Multi-service projects must specify serviceId/serviceName or use services[] when creating a release'
    );
  }

  return inputs.map((input) => {
    let service =
      (input.id ? projectServices.find((candidate) => candidate.id === input.id) : undefined) ??
      (input.name ? projectServices.find((candidate) => candidate.name === input.name) : undefined);

    if (!service && projectServices.length === 1) {
      service = projectServices[0];
    }

    if (!service || service.projectId !== projectId) {
      throw new Error(
        `Unable to resolve service for release artifact ${input.name ?? input.id ?? input.image}`
      );
    }

    return {
      id: service.id,
      name: service.name,
      image: input.image,
      digest: input.digest ?? null,
    };
  });
}

export function summarizeReleasePlan(input: {
  environment: PlanningEnvironmentLike;
  services: PlanningServiceLike[];
  migrationSpecs: PlanningMigrationSpecLike[];
  migrationWarnings?: string[];
  schemaGate?: ReleaseSchemaGateSnapshot | null;
}): ReleasePlanningSnapshot {
  const preDeploySpecs = input.migrationSpecs.filter(
    (spec) => spec.specification.phase === 'preDeploy'
  );
  const postDeploySpecs = input.migrationSpecs.filter(
    (spec) => spec.specification.phase === 'postDeploy'
  );
  const automaticSpecs = input.migrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'automatic'
  );
  const manualPlatformSpecs = input.migrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'manual_platform'
  );
  const externalSpecs = input.migrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'external'
  );
  const preDeployManualPlatformCount = preDeploySpecs.filter(
    (spec) => spec.specification.executionMode === 'manual_platform'
  ).length;
  const preDeployExternalCount = preDeploySpecs.filter(
    (spec) => spec.specification.executionMode === 'external'
  ).length;
  const migrationDecisions = input.migrationSpecs.map((spec) =>
    evaluateMigrationPolicy({
      environment: spec.environment,
      specification: spec.specification,
    })
  );
  const warnings = dedupe([
    ...migrationDecisions.flatMap((decision) => decision.warnings),
    ...(input.migrationWarnings ?? []),
  ]);
  const migrationSignals = dedupeMigrationSignals(
    migrationDecisions.flatMap((decision) => decision.signals)
  );
  const environmentPolicy = evaluateEnvironmentPolicy(input.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: input.environment,
    migrationRuns: input.migrationSpecs.map((spec) => ({
      specification: spec.specification,
    })),
  });
  const previewDatabaseGuard = inspectPreviewDatabaseGuard({
    environment: input.environment,
    migrationSpecs: input.migrationSpecs,
  });
  const requiresExternalCompletion = preDeployExternalCount > 0;
  const migrationBlockingReason =
    preDeployManualPlatformCount > 0 || preDeployExternalCount > 0
      ? '存在未满足的前置迁移门禁'
      : null;
  const schemaGate = input.schemaGate ?? null;
  const blockingReason =
    previewDatabaseGuard.blockingReason ?? schemaGate?.blockingReason ?? migrationBlockingReason;
  const issue = releasePolicy.requiresApproval ? buildIssueSnapshot('approval_blocked') : null;
  const totalAutomatic = automaticSpecs.length;
  const environmentInheritance = getEnvironmentInheritancePresentation(input.environment);
  const environmentDatabaseStrategy = getEnvironmentDatabaseStrategyLabel(
    input.environment.databaseStrategy
  );
  const platformSignals = buildPlatformSignalSnapshot({
    customSignals: [
      ...previewDatabaseGuard.customSignals,
      ...(environmentInheritance
        ? [
            {
              key: environmentInheritance.key,
              label: environmentInheritance.label,
              tone: 'neutral' as const,
            },
          ]
        : []),
      ...(schemaGate?.customSignals ?? []),
    ],
    issue,
    customSummary: previewDatabaseGuard.summary ?? schemaGate?.summary ?? null,
    customNextActionLabel:
      previewDatabaseGuard.nextActionLabel ?? schemaGate?.nextActionLabel ?? null,
    environmentPolicySignals: environmentPolicy.signals,
    environmentPolicySignal: environmentPolicy.primarySignal,
    releasePolicySignals: releasePolicy.signals,
    releasePolicySignal: releasePolicy.primarySignal,
    migrationPolicySignals: migrationSignals,
    migrationPolicySignal: migrationSignals[0] ?? null,
  });

  return {
    canCreate: (schemaGate?.canCreate ?? true) && previewDatabaseGuard.canCreate,
    blockingReason,
    services: input.services,
    environmentPolicy,
    releasePolicy,
    issue,
    platformSignals,
    migration: {
      preDeployCount: preDeploySpecs.length,
      postDeployCount: postDeploySpecs.length,
      automaticCount: automaticSpecs.length,
      manualPlatformCount: manualPlatformSpecs.length,
      externalCount: externalSpecs.length,
      warnings,
      signals: migrationSignals,
      primarySignal: migrationSignals[0] ?? null,
      requiresApproval: releasePolicy.requiresApproval,
      requiresExternalCompletion,
    },
    schema: {
      checkedCount: schemaGate?.checkedCount ?? 0,
      blockingCount: schemaGate?.blockingCount ?? 0,
      states: schemaGate?.states ?? [],
      summary: schemaGate?.summary ?? null,
      nextActionLabel: schemaGate?.nextActionLabel ?? null,
    },
    environmentInheritance: environmentInheritance?.label ?? null,
    environmentDatabaseStrategy,
    summary:
      blockingReason ??
      previewDatabaseGuard.summary ??
      schemaGate?.summary ??
      releasePolicy.summary ??
      environmentPolicy.summary ??
      environmentInheritance?.summary ??
      (totalAutomatic > 0 ? `包含 ${totalAutomatic} 项自动迁移` : null),
  };
}

export async function buildProjectReleasePlan(input: {
  projectId: string;
  environmentId: string;
  services: ReleaseServiceInput[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  entryPoint?: ReleaseEntryPoint;
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
  const effectiveMigrationSpecs = await Promise.all(
    [...preDeploySpecs, ...postDeploySpecs].map(async (spec) => ({
      spec,
      pendingInspection: await inspectResolvedMigrationSpecPendingState(spec, {
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      }),
    }))
  );
  const unknownInspectionCount = effectiveMigrationSpecs.filter(
    ({ pendingInspection }) => pendingInspection.state === 'unknown'
  ).length;
  const unknownInspectionWarning =
    unknownInspectionCount > 0
      ? `有 ${unknownInspectionCount} 个迁移策略暂时无法确认是否存在 schema 变更，系统将按保守策略继续执行或审批。`
      : null;
  const filteredMigrationSpecs = effectiveMigrationSpecs
    .filter(({ pendingInspection }) => pendingInspection.state !== 'none')
    .map(({ spec }) => spec);
  const schemaGate = await inspectReleaseSchemaGate({
    projectId: project.id,
    environmentId: environment.id,
    serviceIds,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });

  return summarizeReleasePlan({
    environment,
    services: plannedServices,
    migrationSpecs: filteredMigrationSpecs,
    migrationWarnings: unknownInspectionWarning ? [unknownInspectionWarning] : [],
    schemaGate,
  });
}

function buildStaticPromotionPlan(input: {
  sourceEnvironment?: PromotionPlanSnapshot['sourceEnvironment'];
  targetEnvironment?: PromotionPlanSnapshot['targetEnvironment'];
  flowId?: string | null;
  strategy?: PromotionFlowStrategy | null;
  requiresApproval?: boolean;
  blockingReason: string;
  environment?: PlanningEnvironmentLike;
}): PromotionPlanSnapshot {
  return {
    flowId: input.flowId ?? null,
    strategy: input.strategy ?? null,
    requiresApproval: input.requiresApproval ?? false,
    sourceRelease: null,
    sourceEnvironment: input.sourceEnvironment ?? null,
    targetEnvironment: input.targetEnvironment ?? null,
    plan: buildStaticPlanningSnapshot({
      canCreate: false,
      blockingReason: input.blockingReason,
      environment: input.environment ?? input.targetEnvironment ?? { isProduction: false },
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

async function buildPromotionPlanForResolution(
  projectId: string,
  resolution: PromotionFlowResolution
): Promise<PromotionPlanSnapshot> {
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

  const sourceRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, projectId),
      eq(releases.environmentId, resolution.sourceEnvironment.id),
      eq(releases.status, 'succeeded')
    ),
    orderBy: [desc(releases.createdAt)],
    with: {
      artifacts: {
        with: {
          service: true,
        },
      },
    },
  });

  if (!sourceRelease || sourceRelease.artifacts.length === 0) {
    return buildStaticPromotionPlan({
      sourceEnvironment,
      targetEnvironment,
      flowId: resolution.flow?.id ?? null,
      strategy,
      requiresApproval,
      blockingReason: `${resolution.sourceEnvironment.name} 暂无可复用的成功发布`,
      environment: resolution.targetEnvironment,
    });
  }

  const plan = await buildProjectReleasePlan({
    projectId,
    environmentId: resolution.targetEnvironment.id,
    services: sourceRelease.artifacts.map((artifact) => ({
      id: artifact.serviceId,
      name: artifact.service.name,
      image: artifact.imageUrl,
      digest: artifact.imageDigest,
    })),
    sourceRef: sourceRelease.sourceRef,
    sourceCommitSha: sourceRelease.sourceCommitSha,
    entryPoint: 'promotion',
  });

  return {
    flowId: resolution.flow?.id ?? null,
    strategy,
    requiresApproval,
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
  }
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

    return buildPromotionPlanForResolution(projectId, resolution);
  }

  const resolution = resolutions[0] ?? null;

  if (!resolution) {
    return buildStaticPromotionPlan({
      blockingReason: '当前项目还没有配置环境提升链路',
      environment: { isProduction: false },
    });
  }

  return buildPromotionPlanForResolution(projectId, resolution);
}

export async function buildPromotionPlans(projectId: string): Promise<PromotionPlanSnapshot[]> {
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
    resolutions.map((resolution) => buildPromotionPlanForResolution(projectId, resolution))
  );
}

export async function buildRollbackPlan(input: {
  projectId: string;
  deploymentId: string;
}): Promise<{
  sourceDeployment: {
    id: string;
    imageUrl: string;
    commitSha: string | null;
    environmentId: string;
    serviceId: string | null;
    branch: string | null;
  } | null;
  plan: ReleasePlanningSnapshot;
}> {
  const { project } = await requireProjectRepositoryContext(input.projectId);

  const targetDeployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, input.deploymentId),
  });

  if (!targetDeployment || targetDeployment.projectId !== input.projectId) {
    return {
      sourceDeployment: null,
      plan: buildStaticPlanningSnapshot({
        canCreate: false,
        blockingReason: 'Deployment not found',
        environment: { isProduction: false },
        summary: null,
      }),
    };
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, targetDeployment.environmentId),
  });

  if (!environment || environment.projectId !== input.projectId) {
    return {
      sourceDeployment: null,
      plan: buildStaticPlanningSnapshot({
        canCreate: false,
        blockingReason: 'Environment not found',
        environment: { isProduction: false },
        summary: null,
      }),
    };
  }

  if (!targetDeployment.imageUrl) {
    return {
      sourceDeployment: null,
      plan: buildStaticPlanningSnapshot({
        canCreate: false,
        blockingReason: 'Deployment has no image URL — cannot roll back to this version',
        environment,
      }),
    };
  }

  const plan = await buildProjectReleasePlan({
    projectId: input.projectId,
    environmentId: targetDeployment.environmentId,
    services: [
      {
        id: targetDeployment.serviceId ?? undefined,
        image: targetDeployment.imageUrl,
      },
    ],
    sourceRef: getProjectSourceRef({ branch: targetDeployment.branch, ...project }),
    sourceCommitSha: targetDeployment.commitSha ?? null,
    entryPoint: 'rollback',
  });

  return {
    sourceDeployment: {
      id: targetDeployment.id,
      imageUrl: targetDeployment.imageUrl,
      commitSha: targetDeployment.commitSha ?? null,
      environmentId: targetDeployment.environmentId,
      serviceId: targetDeployment.serviceId ?? null,
      branch: targetDeployment.branch ?? null,
    },
    plan,
  };
}
