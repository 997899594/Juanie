import type * as k8s from '@kubernetes/client-node';
import { desc, eq } from 'drizzle-orm';
import { type ArgoRolloutResourceLike, getArgoRollout } from '@/lib/argocd';
import { db } from '@/lib/db';
import {
  deploymentDiagnostics,
  deployments,
  environments,
  projects,
  services,
} from '@/lib/db/schema';
import type {
  DeploymentDiagnosticCondition,
  DeploymentDiagnosticContainerSnapshot,
  DeploymentDiagnosticEventSnapshot,
  DeploymentDiagnosticLogTailSnapshot,
  DeploymentDiagnosticPodSnapshot,
  DeploymentDiagnosticSnapshot,
  DeploymentDiagnosticWorkloadSnapshot,
} from '@/lib/deployments/diagnostics-types';
import { getEvents, getK8sClient, getPodLogs, getPods, isK8sAvailable } from '@/lib/k8s';
import {
  describeReplicaSetReadiness,
  describeReplicaSetStatus,
  formatK8sLabelSelector,
  getReplicaSetPodLabelSelector,
  selectActiveDeploymentReplicaSet,
} from '@/lib/k8s/deployment-rollout';
import {
  collectDeploymentPodIssues,
  formatDeploymentPodIssue,
  formatPodWarningEvent,
  getEventTimestamp,
  getPodStatusMessage,
  isReadinessWarning,
} from '@/lib/k8s/pod-diagnostics';
import { logger } from '@/lib/logger';
import {
  shouldUseArgoRolloutsForService,
  supportsArgoRolloutsDeploymentStrategy,
} from '@/lib/releases/argo-rollouts';
import { buildStableDeploymentName } from '@/lib/releases/traffic';
import { buildServiceVerificationPlan } from '@/lib/releases/workloads';

const diagnosticLogger = logger.child({ component: 'deployment-diagnostics' });
const LOG_TAIL_LINES = 40;
const LOG_TAIL_LIMIT_BYTES = 24_576;
const LOG_TAIL_MAX_CHARS = 6_000;
const MAX_EVENTS = 12;
const MAX_PODS = 8;

export type DeploymentDiagnosticReason =
  | 'deployment_failed'
  | 'rollout_failed'
  | 'verification_failed'
  | 'diagnostics_unavailable';

interface DeploymentDiagnosticContext {
  deployment: typeof deployments.$inferSelect;
  project: typeof projects.$inferSelect;
  environment: typeof environments.$inferSelect;
  service: typeof services.$inferSelect | null;
}

interface CaptureDeploymentDiagnosticsInput {
  deploymentId: string;
  reason: DeploymentDiagnosticReason;
  errorMessage: string;
}

interface ReadLatestDeploymentDiagnosticsInput {
  deploymentIds: string[];
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number };
  return (candidate.code ?? candidate.statusCode) === 404;
}

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(
      /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:\s/@]+):([^@\s]+)@/gi,
      '$1://$2:[redacted]@'
    )
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(
      /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*)(\s*[=:]\s*)(["']?)[^\s"']+\3/gi,
      '$1$2[redacted]'
    );
}

function sanitizeOptionalText(value?: string | null): string | null {
  return value ? sanitizeDiagnosticText(value) : null;
}

function trimLogTail(value: string): string | null {
  const lines = sanitizeDiagnosticText(value)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  const tail = lines.slice(-LOG_TAIL_LINES).join('\n');
  if (tail.length <= LOG_TAIL_MAX_CHARS) {
    return tail;
  }

  return tail.slice(tail.length - LOG_TAIL_MAX_CHARS);
}

function toIsoString(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLabels(labels?: Record<string, string>): Record<string, string> {
  return labels ? { ...labels } : {};
}

function conditionSnapshot(condition: {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
}): DeploymentDiagnosticCondition {
  return {
    type: condition.type ?? 'Unknown',
    status: condition.status ?? 'Unknown',
    reason: condition.reason ?? null,
    message: sanitizeOptionalText(condition.message),
  };
}

function getContainerState(status: k8s.V1ContainerStatus): {
  state: string | null;
  reason: string | null;
  message: string | null;
  exitCode: number | null;
} {
  if (status.state?.waiting) {
    return {
      state: 'waiting',
      reason: status.state.waiting.reason ?? null,
      message: sanitizeOptionalText(status.state.waiting.message),
      exitCode: null,
    };
  }

  if (status.state?.terminated) {
    return {
      state: 'terminated',
      reason: status.state.terminated.reason ?? null,
      message: sanitizeOptionalText(status.state.terminated.message),
      exitCode: status.state.terminated.exitCode ?? null,
    };
  }

  if (status.state?.running) {
    return {
      state: 'running',
      reason: null,
      message: null,
      exitCode: null,
    };
  }

  return {
    state: null,
    reason: null,
    message: null,
    exitCode: null,
  };
}

function containerSnapshot(status: k8s.V1ContainerStatus): DeploymentDiagnosticContainerSnapshot {
  const state = getContainerState(status);
  return {
    name: status.name ?? 'container',
    image: status.image ?? null,
    ready: status.ready ?? null,
    restartCount: status.restartCount ?? null,
    state: state.state,
    reason: state.reason,
    message: state.message,
    exitCode: state.exitCode,
    lastReason: status.lastState?.terminated?.reason ?? null,
    lastExitCode: status.lastState?.terminated?.exitCode ?? null,
  };
}

function podSnapshot(pod: k8s.V1Pod): DeploymentDiagnosticPodSnapshot {
  const statuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];
  const message = getPodStatusMessage(pod);
  const containers = statuses.map(containerSnapshot);
  const containerSummary =
    containers.length > 0
      ? containers
          .map((container) =>
            [
              container.name,
              container.state,
              container.reason,
              container.exitCode !== null ? `exit ${container.exitCode}` : null,
              container.restartCount !== null ? `restarts ${container.restartCount}` : null,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join(' | ')
      : 'no containers';

  return {
    name: pod.metadata?.name ?? 'pod',
    phase: pod.status?.phase ?? null,
    reason: pod.status?.reason ?? null,
    message: sanitizeOptionalText(message),
    nodeName: pod.spec?.nodeName ?? null,
    podIp: pod.status?.podIP ?? null,
    createdAt: toIsoString(pod.metadata?.creationTimestamp ?? null),
    labels: normalizeLabels(pod.metadata?.labels),
    summary: [
      `${pod.metadata?.name ?? 'pod'}: ${pod.status?.phase ?? 'Unknown'}`,
      pod.status?.reason ?? null,
      sanitizeOptionalText(message),
      containerSummary,
    ]
      .filter(Boolean)
      .join(' · '),
    containers,
  };
}

function eventSnapshot(event: k8s.CoreV1Event): DeploymentDiagnosticEventSnapshot {
  return {
    type: event.type ?? null,
    reason: event.reason ?? null,
    message: sanitizeOptionalText(event.message),
    involvedObjectKind: event.involvedObject.kind ?? null,
    involvedObjectName: event.involvedObject.name ?? null,
    timestamp: toIsoString(event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp ?? null),
  };
}

async function readDeployment(namespace: string, name: string): Promise<k8s.V1Deployment | null> {
  const { apps } = getK8sClient();

  try {
    return await apps.readNamespacedDeployment({ namespace, name });
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function listReplicaSets(
  namespace: string,
  labelSelector?: string
): Promise<k8s.V1ReplicaSet[]> {
  const { apps } = getK8sClient();
  const response = await apps.listNamespacedReplicaSet({ namespace, labelSelector });
  return response.items;
}

async function getPodsForSelector(
  namespace: string,
  selector: string | null
): Promise<k8s.V1Pod[]> {
  if (!selector) {
    return [];
  }

  return getPods(namespace, selector);
}

function getFirstContainerImageFromPodTemplate(podTemplate?: k8s.V1PodTemplateSpec): string | null {
  return podTemplate?.spec?.containers?.[0]?.image ?? null;
}

function summarizeDeploymentWorkload(
  deployment: k8s.V1Deployment,
  activeReplicaSet: k8s.V1ReplicaSet | null
): string {
  return [
    `Deployment ${deployment.metadata?.name ?? 'deployment'}`,
    `generation ${deployment.status?.observedGeneration ?? 0}/${deployment.metadata?.generation ?? 0}`,
    `desired ${deployment.spec?.replicas ?? 1}`,
    `updated ${deployment.status?.updatedReplicas ?? 0}`,
    `ready ${deployment.status?.readyReplicas ?? 0}`,
    `available ${deployment.status?.availableReplicas ?? 0}`,
    activeReplicaSet ? describeReplicaSetStatus(activeReplicaSet) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

async function buildDeploymentWorkloadSnapshot(input: {
  namespace: string;
  name: string;
}): Promise<{
  workload: DeploymentDiagnosticWorkloadSnapshot;
  pods: k8s.V1Pod[];
}> {
  const deployment = await readDeployment(input.namespace, input.name);

  if (!deployment) {
    return {
      workload: {
        kind: 'deployment',
        name: input.name,
        namespace: input.namespace,
        summary: `Deployment ${input.name} not found`,
        selector: null,
        desiredReplicas: null,
        updatedReplicas: null,
        readyReplicas: null,
        availableReplicas: null,
        generation: null,
        observedGeneration: null,
        phase: 'missing',
        image: null,
        conditions: [],
      },
      pods: [],
    };
  }

  const selector = formatK8sLabelSelector(deployment.spec?.selector?.matchLabels ?? {});
  const replicaSets = await listReplicaSets(input.namespace, selector || undefined);
  const activeReplicaSet = selectActiveDeploymentReplicaSet(deployment, replicaSets);
  const podSelector = activeReplicaSet ? getReplicaSetPodLabelSelector(activeReplicaSet) : selector;
  const pods = await getPodsForSelector(input.namespace, podSelector || null);

  return {
    workload: {
      kind: 'deployment',
      name: deployment.metadata?.name ?? input.name,
      namespace: deployment.metadata?.namespace ?? input.namespace,
      summary: `${summarizeDeploymentWorkload(deployment, activeReplicaSet)} · ${describeReplicaSetReadiness(
        deployment,
        activeReplicaSet
      )}`,
      selector: podSelector || selector || null,
      desiredReplicas: deployment.spec?.replicas ?? 1,
      updatedReplicas: deployment.status?.updatedReplicas ?? null,
      readyReplicas: deployment.status?.readyReplicas ?? null,
      availableReplicas: deployment.status?.availableReplicas ?? null,
      generation: deployment.metadata?.generation ?? null,
      observedGeneration: deployment.status?.observedGeneration ?? null,
      phase: null,
      image: getFirstContainerImageFromPodTemplate(deployment.spec?.template),
      conditions: (deployment.status?.conditions ?? []).map(conditionSnapshot),
    },
    pods,
  };
}

function summarizeArgoRollout(rollout: ArgoRolloutResourceLike, name: string): string {
  return [
    `Argo Rollout ${rollout.metadata?.name ?? name}`,
    `phase ${rollout.status?.phase ?? 'unknown'}`,
    `observed ${rollout.status?.observedGeneration ?? 'unknown'}`,
    `generation ${rollout.metadata?.generation ?? 'unknown'}`,
    `updated ${rollout.status?.updatedReplicas ?? 0}`,
    `available ${rollout.status?.availableReplicas ?? 0}`,
    `desired ${rollout.spec?.replicas ?? 1}`,
  ].join(' · ');
}

async function buildArgoRolloutWorkloadSnapshot(input: {
  namespace: string;
  name: string;
}): Promise<{
  workload: DeploymentDiagnosticWorkloadSnapshot;
  pods: k8s.V1Pod[];
}> {
  const rollout = await getArgoRollout(input.namespace, input.name);

  if (!rollout) {
    return {
      workload: {
        kind: 'argo_rollout',
        name: input.name,
        namespace: input.namespace,
        summary: `Argo Rollout ${input.name} not found`,
        selector: null,
        desiredReplicas: null,
        updatedReplicas: null,
        readyReplicas: null,
        availableReplicas: null,
        generation: null,
        observedGeneration: null,
        phase: 'missing',
        image: null,
        conditions: [],
      },
      pods: [],
    };
  }

  const activeSelector = rollout.status?.blueGreen?.activeSelector ?? null;
  const previewSelector = rollout.status?.blueGreen?.previewSelector ?? null;
  const currentSelector = activeSelector ?? previewSelector;
  const appLabel = rollout.metadata?.name ?? input.name;
  const podSelector = currentSelector
    ? formatK8sLabelSelector({
        app: appLabel,
        'rollouts-pod-template-hash': currentSelector,
      })
    : formatK8sLabelSelector({ app: appLabel });
  const pods = await getPodsForSelector(input.namespace, podSelector || null);

  return {
    workload: {
      kind: 'argo_rollout',
      name: rollout.metadata?.name ?? input.name,
      namespace: rollout.metadata?.namespace ?? input.namespace,
      summary: summarizeArgoRollout(rollout, input.name),
      selector: podSelector || null,
      desiredReplicas: rollout.spec?.replicas ?? 1,
      updatedReplicas: rollout.status?.updatedReplicas ?? null,
      readyReplicas: rollout.status?.readyReplicas ?? null,
      availableReplicas: rollout.status?.availableReplicas ?? null,
      generation: rollout.metadata?.generation ?? null,
      observedGeneration: rollout.status?.observedGeneration ?? null,
      phase: rollout.status?.phase ?? null,
      image: rollout.spec?.template?.spec?.containers?.[0]?.image ?? null,
      stableSelector: activeSelector,
      previewSelector,
      conditions: (rollout.status?.conditions ?? []).map(conditionSnapshot),
    },
    pods,
  };
}

function selectRelevantEvents(events: k8s.CoreV1Event[], pods: k8s.V1Pod[]) {
  const podNames = new Set(
    pods.map((pod) => pod.metadata?.name).filter((name): name is string => Boolean(name))
  );

  return events
    .filter((event) => {
      if (event.involvedObject.kind !== 'Pod') {
        return false;
      }

      return podNames.has(event.involvedObject.name ?? '');
    })
    .sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left))
    .sort((left, right) => {
      const leftPriority = left.type === 'Warning' && isReadinessWarning(left) ? 0 : 1;
      const rightPriority = right.type === 'Warning' && isReadinessWarning(right) ? 0 : 1;
      return leftPriority - rightPriority;
    })
    .slice(0, MAX_EVENTS);
}

async function collectLogTails(
  namespace: string,
  pods: k8s.V1Pod[]
): Promise<DeploymentDiagnosticLogTailSnapshot[]> {
  const issues = collectDeploymentPodIssues(pods);
  const issueSources =
    issues.length > 0
      ? issues.map((issue) => ({
          podName: issue.podName,
          containerName: issue.containerName,
          attempts:
            issue.state === 'waiting'
              ? [{ previous: true }, { previous: false }]
              : [{ previous: false }, { previous: true }],
        }))
      : pods.flatMap((pod) =>
          (pod.status?.containerStatuses ?? []).map((container) => ({
            podName: pod.metadata?.name ?? 'pod',
            containerName: container.name ?? 'container',
            attempts: [{ previous: false }],
          }))
        );

  const tails: DeploymentDiagnosticLogTailSnapshot[] = [];

  for (const source of issueSources.slice(0, 3)) {
    for (const attempt of source.attempts) {
      try {
        const logs = await getPodLogs(namespace, source.podName, source.containerName, {
          tailLines: LOG_TAIL_LINES,
          limitBytes: LOG_TAIL_LIMIT_BYTES,
          previous: attempt.previous,
          timestamps: false,
        });
        const text = trimLogTail(logs);
        if (!text) {
          continue;
        }

        tails.push({
          podName: source.podName,
          containerName: source.containerName,
          previous: attempt.previous,
          text,
        });
        break;
      } catch (error) {
        diagnosticLogger.warn('Could not read deployment diagnostic logs', {
          namespace,
          podName: source.podName,
          containerName: source.containerName,
          previous: attempt.previous,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return tails;
}

function summarizeSnapshot(input: {
  workload: DeploymentDiagnosticWorkloadSnapshot;
  pods: DeploymentDiagnosticPodSnapshot[];
  events: DeploymentDiagnosticEventSnapshot[];
  logTails: DeploymentDiagnosticLogTailSnapshot[];
  errorMessage: string;
}): string {
  const podIssue = input.pods.find((pod) =>
    pod.containers.some((container) => container.state === 'waiting' || container.exitCode)
  );
  const event = input.events.find((item) => item.type === 'Warning') ?? input.events[0] ?? null;
  const parts = [
    input.workload.summary,
    podIssue?.summary ?? null,
    event
      ? `${event.involvedObjectName ?? 'pod'} · ${event.reason ?? 'Event'}${
          event.message ? `: ${event.message}` : ''
        }`
      : null,
    input.logTails[0] ? `logs: ${input.logTails[0].text.split('\n').slice(-3).join(' ')}` : null,
  ].filter(Boolean);

  return sanitizeDiagnosticText(parts.join('\n') || input.errorMessage).slice(0, 4_000);
}

async function loadDeploymentDiagnosticContext(
  deploymentId: string
): Promise<DeploymentDiagnosticContext | null> {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });

  if (!deployment) {
    return null;
  }

  const [project, environment, service] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, deployment.projectId),
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
    return null;
  }

  return { deployment, project, environment, service: service ?? null };
}

function resolveWorkload(input: DeploymentDiagnosticContext): {
  kind: 'deployment' | 'argo_rollout' | 'unknown';
  name: string | null;
} {
  if (!input.service) {
    return { kind: 'unknown', name: null };
  }

  const name = buildStableDeploymentName(input.project.slug, input.service.name);
  const usesArgoRollouts =
    supportsArgoRolloutsDeploymentStrategy(input.environment.deploymentStrategy) &&
    shouldUseArgoRolloutsForService({
      strategy: input.environment.deploymentStrategy,
      service: input.service,
      hasBlockingVerification: buildServiceVerificationPlan(input.service).blockingPaths.length > 0,
    });

  return {
    kind: usesArgoRollouts ? 'argo_rollout' : 'deployment',
    name,
  };
}

function unavailableSnapshot(input: {
  capturedAt: Date;
  reason: DeploymentDiagnosticReason;
  errorMessage: string;
  namespace: string | null;
  workloadKind: 'deployment' | 'argo_rollout' | 'unknown';
  workloadName: string | null;
  summary: string;
}): DeploymentDiagnosticSnapshot {
  return {
    schemaVersion: 1,
    capturedAt: input.capturedAt.toISOString(),
    reason: input.reason,
    errorMessage: sanitizeDiagnosticText(input.errorMessage),
    namespace: input.namespace,
    workload: {
      kind: input.workloadKind,
      name: input.workloadName,
      namespace: input.namespace,
      summary: input.summary,
      selector: null,
      desiredReplicas: null,
      updatedReplicas: null,
      readyReplicas: null,
      availableReplicas: null,
      generation: null,
      observedGeneration: null,
      phase: 'unknown',
      image: null,
      conditions: [],
    },
    pods: [],
    events: [],
    logTails: [],
  };
}

export async function captureDeploymentDiagnostics(
  input: CaptureDeploymentDiagnosticsInput
): Promise<typeof deploymentDiagnostics.$inferSelect | null> {
  const context = await loadDeploymentDiagnosticContext(input.deploymentId);

  if (!context) {
    return null;
  }

  const capturedAt = new Date();
  const namespace = context.environment.namespace ?? null;
  const workloadRef = resolveWorkload(context);
  const workloadKind = workloadRef.kind ?? 'unknown';
  const workloadName = workloadRef.name;

  let snapshot: DeploymentDiagnosticSnapshot;

  try {
    if (!isK8sAvailable()) {
      throw new Error('Kubernetes client is not available');
    }

    if (!namespace || !workloadName || workloadKind === 'unknown') {
      throw new Error('Deployment diagnostic context is incomplete');
    }

    const workloadResult =
      workloadKind === 'argo_rollout'
        ? await buildArgoRolloutWorkloadSnapshot({ namespace, name: workloadName })
        : await buildDeploymentWorkloadSnapshot({ namespace, name: workloadName });
    const pods = workloadResult.pods.slice(0, MAX_PODS);
    const events = selectRelevantEvents(await getEvents(namespace), pods).map(eventSnapshot);
    const logTails = await collectLogTails(namespace, pods);
    const podSnapshots = pods.map(podSnapshot);
    const summary = summarizeSnapshot({
      workload: workloadResult.workload,
      pods: podSnapshots,
      events,
      logTails,
      errorMessage: input.errorMessage,
    });

    snapshot = {
      schemaVersion: 1,
      capturedAt: capturedAt.toISOString(),
      reason: input.reason,
      errorMessage: sanitizeDiagnosticText(input.errorMessage),
      namespace,
      workload: workloadResult.workload,
      pods: podSnapshots,
      events,
      logTails,
    };

    const [inserted] = await db
      .insert(deploymentDiagnostics)
      .values({
        deploymentId: context.deployment.id,
        releaseId: context.deployment.releaseId,
        projectId: context.deployment.projectId,
        environmentId: context.deployment.environmentId,
        serviceId: context.deployment.serviceId,
        namespace,
        workloadKind,
        workloadName,
        reason: input.reason,
        summary,
        errorMessage: sanitizeDiagnosticText(input.errorMessage),
        snapshot,
        capturedAt,
      })
      .returning();

    return inserted ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnosticLogger.warn('Deployment diagnostics capture failed', {
      deploymentId: input.deploymentId,
      namespace,
      workloadKind,
      workloadName,
      errorMessage: message,
    });

    snapshot = unavailableSnapshot({
      capturedAt,
      reason: 'diagnostics_unavailable',
      errorMessage: input.errorMessage,
      namespace,
      workloadKind,
      workloadName,
      summary: `Deployment diagnostics unavailable: ${message}`,
    });

    const [inserted] = await db
      .insert(deploymentDiagnostics)
      .values({
        deploymentId: context.deployment.id,
        releaseId: context.deployment.releaseId,
        projectId: context.deployment.projectId,
        environmentId: context.deployment.environmentId,
        serviceId: context.deployment.serviceId,
        namespace,
        workloadKind,
        workloadName,
        reason: 'diagnostics_unavailable',
        summary: snapshot.workload.summary,
        errorMessage: sanitizeDiagnosticText(input.errorMessage),
        snapshot,
        capturedAt,
      })
      .returning();

    return inserted ?? null;
  }
}

export async function readLatestDeploymentDiagnostics(input: ReadLatestDeploymentDiagnosticsInput) {
  if (input.deploymentIds.length === 0) {
    return new Map<string, typeof deploymentDiagnostics.$inferSelect>();
  }

  const latest = await db.query.deploymentDiagnostics.findMany({
    where: (diagnostic, { inArray }) => inArray(diagnostic.deploymentId, input.deploymentIds),
    orderBy: [desc(deploymentDiagnostics.capturedAt)],
  });
  const byDeploymentId = new Map<string, typeof deploymentDiagnostics.$inferSelect>();

  for (const diagnostic of latest) {
    if (!byDeploymentId.has(diagnostic.deploymentId)) {
      byDeploymentId.set(diagnostic.deploymentId, diagnostic);
    }
  }

  return byDeploymentId;
}

export function getPrimaryDiagnosticLine(snapshot: DeploymentDiagnosticSnapshot): string | null {
  const issue = collectDeploymentPodIssues(
    snapshot.pods.map(
      (pod) =>
        ({
          metadata: { name: pod.name },
          status: {
            containerStatuses: pod.containers.map((container) => ({
              name: container.name,
              restartCount: container.restartCount ?? 0,
              state:
                container.state === 'waiting'
                  ? {
                      waiting: {
                        reason: container.reason ?? undefined,
                        message: container.message ?? undefined,
                      },
                    }
                  : container.state === 'terminated'
                    ? {
                        terminated: {
                          reason: container.reason ?? undefined,
                          message: container.message ?? undefined,
                          exitCode: container.exitCode ?? 0,
                        },
                      }
                    : { running: {} },
              lastState:
                container.lastReason || container.lastExitCode !== null
                  ? {
                      terminated: {
                        reason: container.lastReason ?? undefined,
                        exitCode: container.lastExitCode ?? 0,
                      },
                    }
                  : undefined,
            })),
          },
        }) as k8s.V1Pod
    )
  )[0];

  if (issue) {
    return formatDeploymentPodIssue(issue);
  }

  const event = snapshot.events.find((item) => item.type === 'Warning') ?? snapshot.events[0];
  if (event) {
    return `${event.involvedObjectName ?? 'pod'} · ${event.reason ?? 'Event'}${
      event.message ? `: ${event.message}` : ''
    }`;
  }

  return snapshot.workload.summary || null;
}

export function formatDiagnosticEvent(event: DeploymentDiagnosticEventSnapshot): string {
  return formatPodWarningEvent({
    metadata: {},
    involvedObject: {
      kind: event.involvedObjectKind ?? 'Pod',
      name: event.involvedObjectName ?? 'pod',
    },
    reason: event.reason ?? undefined,
    message: event.message ?? undefined,
    type: event.type ?? undefined,
  } as k8s.CoreV1Event);
}
