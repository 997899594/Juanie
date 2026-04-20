import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, services } from '@/lib/db/schema';
import { getEnvironmentDeploymentRuntime, usesArgoRolloutsRuntime } from '@/lib/environments/model';
import { deploymentExists, getDeploymentSnapshot, getIsConnected } from '@/lib/k8s';
import {
  appendDeploymentRealtimeLogs,
  updateDeploymentRealtimeState,
} from '@/lib/realtime/deployments';
import {
  finalizeArgoRollout,
  getArgoRolloutSnapshot,
  supportsArgoRolloutsDeploymentStrategy,
} from '@/lib/releases/argo-rollouts';
import {
  completeReleaseAfterRolloutIfReady,
  persistReleaseRecapSafely,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { buildCandidateDeploymentName, buildStableDeploymentName } from '@/lib/releases/traffic';
import {
  buildServiceVerificationPlan,
  isProgressiveStrategy,
  type ProgressiveDeploymentStrategy,
  promoteCandidateSnapshotToStable,
} from '@/lib/releases/workloads';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

function getStrategyLabel(strategy: ProgressiveDeploymentStrategy): string {
  switch (strategy) {
    case 'controlled':
      return '受控放量';
    case 'canary':
      return '金丝雀';
    case 'blue_green':
      return '蓝绿切换';
  }
}

async function appendDeploymentLog(deploymentId: string, message: string) {
  await appendDeploymentRealtimeLogs([
    {
      deploymentId,
      message,
      level: 'info',
    },
  ]);
}

async function markDeploymentRolloutFailed(
  deploymentId: string,
  message: string,
  status: 'verification_failed' | 'failed' = 'verification_failed'
) {
  await updateDeploymentRealtimeState(deploymentId, {
    status,
    errorMessage: message,
  });

  await appendDeploymentRealtimeLogs([
    {
      deploymentId,
      message: `Rollout failed: ${message}`,
      level: 'error',
    },
  ]);
}

export async function buildDeploymentRolloutPlan(input: {
  projectId: string;
  deploymentId: string;
}) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, input.deploymentId),
  });

  if (!deployment || deployment.projectId !== input.projectId) {
    throw new Error('部署不存在');
  }

  const [project, environment, service] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    }),
    db.query.environments.findFirst({
      where: eq(environments.id, deployment.environmentId),
    }),
    deployment.serviceId
      ? db.query.services.findFirst({
          where: eq(services.id, deployment.serviceId),
        })
      : null,
  ]);

  if (!project || !environment) {
    throw new Error('无法解析部署上下文');
  }

  if (!service) {
    return {
      deployment: null,
      plan: {
        canFinalize: false,
        blockingReason: '当前部署没有服务上下文，无法推进放量',
        strategyLabel: null,
        platformSignals: buildPlatformSignalSnapshot({
          customSignals: [
            {
              key: 'rollout:missing-service',
              label: '缺少服务上下文',
              tone: 'danger',
            },
          ],
          customSummary: '当前部署缺少服务上下文，无法推进渐进式发布',
          customNextActionLabel: '检查部署记录',
        }),
      },
    };
  }

  if (!isProgressiveStrategy(environment.deploymentStrategy)) {
    return {
      deployment: {
        id: deployment.id,
        serviceId: service.id,
      },
      plan: {
        canFinalize: false,
        blockingReason: '当前环境不是渐进式发布策略',
        strategyLabel: null,
        platformSignals: buildPlatformSignalSnapshot({
          customSignals: [
            {
              key: 'rollout:not-progressive',
              label: '非渐进式发布',
              tone: 'neutral',
            },
          ],
          customSummary: '当前环境不是渐进式发布策略，不需要推进放量',
          customNextActionLabel: '继续观察当前发布',
        }),
      },
    };
  }

  if (!getIsConnected() || !environment.namespace) {
    return {
      deployment: {
        id: deployment.id,
        serviceId: service.id,
      },
      plan: {
        canFinalize: false,
        blockingReason: 'Kubernetes 未连接或环境命名空间缺失',
        strategyLabel: getStrategyLabel(environment.deploymentStrategy),
        platformSignals: buildPlatformSignalSnapshot({
          customSignals: [
            {
              key: 'rollout:k8s-missing',
              label: '缺少集群连接',
              tone: 'danger',
            },
          ],
          customSummary: '当前无法连接 Kubernetes，不能推进渐进式发布',
          customNextActionLabel: '检查集群连接',
        }),
      },
    };
  }

  const stableName = buildStableDeploymentName(project.slug, service.name);
  const candidateName = buildCandidateDeploymentName(stableName);
  const deploymentRuntime = getEnvironmentDeploymentRuntime(environment);
  const argoRuntimeEnabled =
    usesArgoRolloutsRuntime({ deploymentRuntime }) &&
    supportsArgoRolloutsDeploymentStrategy(environment.deploymentStrategy);

  const [legacyStableDeploymentExists, candidateSnapshot, argoSnapshot] = await Promise.all([
    deploymentExists(environment.namespace, stableName),
    getDeploymentSnapshot(environment.namespace, candidateName),
    argoRuntimeEnabled ? getArgoRolloutSnapshot(environment.namespace, stableName) : null,
  ]);

  const stableExists = argoRuntimeEnabled
    ? Boolean(argoSnapshot?.image) || legacyStableDeploymentExists
    : legacyStableDeploymentExists;
  const canFinalize = argoRuntimeEnabled ? !!argoSnapshot?.image : !!candidateSnapshot?.image;
  const strategyLabel = getStrategyLabel(environment.deploymentStrategy);
  const candidateImage = argoRuntimeEnabled
    ? (argoSnapshot?.image ?? null)
    : (candidateSnapshot?.image ?? null);

  return {
    deployment: {
      id: deployment.id,
      serviceId: service.id,
      serviceName: service.name,
      runtime: deploymentRuntime,
      stableName,
      candidateName,
      candidateImage,
      stableExists,
    },
    plan: {
      canFinalize,
      blockingReason: canFinalize ? null : '当前还没有 candidate 工作负载，无法推进放量',
      strategyLabel,
      platformSignals: buildPlatformSignalSnapshot({
        customSignals: [
          {
            key: `rollout:${environment.deploymentStrategy}`,
            label: strategyLabel,
            tone: 'neutral',
          },
          ...(stableExists
            ? []
            : [
                {
                  key: 'rollout:first-cutover',
                  label: '首次切换',
                  tone: 'neutral' as const,
                },
              ]),
          ...(candidateImage
            ? [
                {
                  key: 'rollout:candidate-ready',
                  label: '候选版本已就绪',
                  tone: 'neutral' as const,
                },
              ]
            : [
                {
                  key: 'rollout:candidate-missing',
                  label: '候选版本未就绪',
                  tone: 'danger' as const,
                },
              ]),
          ...(argoRuntimeEnabled
            ? [
                {
                  key: 'rollout:argo-rollouts',
                  label: 'Argo Rollouts',
                  tone: 'neutral' as const,
                },
              ]
            : []),
        ],
        customSummary: candidateImage
          ? `当前可以完成 ${strategyLabel}，把候选版本切为正式版本`
          : '当前还没有可切换的候选版本',
        customNextActionLabel: candidateImage ? '确认推进放量' : '等待候选版本部署完成',
      }),
    },
  };
}

export async function finalizeDeploymentRollout(input: {
  projectId: string;
  deploymentId: string;
}) {
  const rollout = await buildDeploymentRolloutPlan(input);

  if (!rollout.deployment || !rollout.plan.canFinalize) {
    throw new Error(rollout.plan.blockingReason ?? '当前无法推进放量');
  }

  const { candidateName, stableName } = rollout.deployment;

  if (!candidateName || !stableName) {
    throw new Error('当前部署缺少渐进式发布上下文');
  }

  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, input.deploymentId),
  });
  const [project, environment, service] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    }),
    deployment
      ? db.query.environments.findFirst({
          where: eq(environments.id, deployment.environmentId),
        })
      : null,
    rollout.deployment.serviceId
      ? db.query.services.findFirst({
          where: eq(services.id, rollout.deployment.serviceId),
        })
      : null,
  ]);

  if (!deployment || !project || !environment || !service) {
    throw new Error('无法解析放量上下文');
  }

  const { namespace } = environment;

  if (!namespace) {
    throw new Error('当前环境缺少命名空间，无法推进放量');
  }

  const deploymentRuntime = getEnvironmentDeploymentRuntime(environment);
  const argoRuntimeEnabled =
    usesArgoRolloutsRuntime({ deploymentRuntime }) &&
    supportsArgoRolloutsDeploymentStrategy(environment.deploymentStrategy);

  const candidateSnapshot = !argoRuntimeEnabled
    ? await getDeploymentSnapshot(namespace, candidateName)
    : null;
  const argoSnapshot = argoRuntimeEnabled
    ? await getArgoRolloutSnapshot(namespace, stableName)
    : null;

  if (
    (!argoRuntimeEnabled && !candidateSnapshot?.image) ||
    (argoRuntimeEnabled && !argoSnapshot?.image)
  ) {
    throw new Error('无法解析放量上下文');
  }

  try {
    if (argoRuntimeEnabled) {
      await finalizeArgoRollout({
        namespace,
        rolloutName: stableName,
        stableServiceName: stableName,
        previewServiceName: candidateName,
        service,
        verificationPlan: buildServiceVerificationPlan(service),
        onLog: (message) => appendDeploymentLog(deployment.id, message),
      });
    } else {
      await promoteCandidateSnapshotToStable({
        namespace,
        projectSlug: project.slug,
        environmentId: environment.id,
        service,
        stableName,
        candidateName,
        snapshot: candidateSnapshot!,
        stableExists: rollout.deployment.stableExists,
        candidateVerified: true,
        onLog: (message) => appendDeploymentLog(deployment.id, message),
      });
    }

    await updateDeploymentRealtimeState(deployment.id, {
      status: 'running',
      errorMessage: null,
      deployedAt: new Date(),
    });

    if (deployment.releaseId) {
      await completeReleaseAfterRolloutIfReady(deployment.releaseId);
    }

    await appendDeploymentLog(
      deployment.id,
      `Completed ${rollout.plan.strategyLabel ?? '渐进式发布'}: switched ${service.name} to stable ${argoSnapshot?.image ?? candidateSnapshot?.image}`
    );

    return {
      success: true,
      deploymentId: deployment.id,
      imageUrl: argoSnapshot?.image ?? candidateSnapshot?.image ?? null,
      strategyLabel: rollout.plan.strategyLabel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markDeploymentRolloutFailed(deployment.id, message);

    if (deployment.releaseId) {
      await updateReleaseStatus(deployment.releaseId, 'verification_failed', message);
      await persistReleaseRecapSafely(deployment.releaseId);
    }

    throw error;
  }
}
