import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s/client';
import { getEvents, getPodLogs, getPods } from '@/lib/k8s/core-resources';
import { getReplicaSets } from '@/lib/k8s/deployment-resources';
import {
  describeReplicaSetReadiness,
  describeReplicaSetStatus,
  formatK8sLabelSelector,
  getReplicaSetPodLabelSelector,
  isReplicaSetReadyForDeployment,
  selectActiveDeploymentReplicaSet,
} from '@/lib/k8s/deployment-rollout';
import {
  buildPlatformOperationJob,
  deletePlatformOperationJob,
  submitPlatformOperationJob,
  waitForPlatformOperationJob,
} from '@/lib/k8s/operation-job';
import {
  collectDeploymentPodIssues,
  formatDeploymentPodIssue,
  formatPodWarningEvent,
  getEventTimestamp,
  isReadinessWarning,
} from '@/lib/k8s/pod-diagnostics';
import {
  buildServiceVerificationScript,
  buildVerificationJobName,
  SERVICE_VERIFY_IMAGE,
} from '@/lib/k8s/service-verification';
import { sleep } from '@/lib/k8s/timing';
import { logger } from '@/lib/logger';

const DEFAULT_DEPLOYMENT_ROLLOUT_TIMEOUT_MS = 10 * 60 * 1000;
const k8sLogger = logger.child({ component: 'k8s-deployment-diagnostics' });

export async function deploymentExists(namespace: string, name: string): Promise<boolean> {
  const { apps } = getK8sClient();

  try {
    await apps.readNamespacedDeployment({ namespace, name });
    return true;
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return false;
    }

    throw e;
  }
}

export interface DeploymentSnapshot {
  image: string | null;
  replicas: number;
  command: string[];
  args: string[];
  env?: Record<string, string>;
  envFrom?: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }>;
  imagePullSecrets?: string[];
  port: number;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
}

async function describeDeploymentEventIssues(
  namespace: string,
  pods: k8s.V1Pod[]
): Promise<string | null> {
  const podNames = new Set(
    pods.map((pod) => pod.metadata?.name).filter((name): name is string => Boolean(name))
  );

  if (podNames.size === 0) {
    return null;
  }

  let events: k8s.CoreV1Event[];
  try {
    events = await getEvents(namespace);
  } catch (error) {
    k8sLogger.warn('Could not list pod events while waiting for deployment readiness', {
      namespace,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const podWarnings = events
    .filter((event) => {
      if (event.type !== 'Warning') {
        return false;
      }

      if (event.involvedObject.kind !== 'Pod') {
        return false;
      }

      return podNames.has(event.involvedObject.name ?? '');
    })
    .sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left));

  const event = podWarnings.find(isReadinessWarning) ?? podWarnings[0];
  if (!event) {
    return null;
  }

  return `${event.involvedObject.name ?? 'pod'} · ${formatPodWarningEvent(event)}`;
}

const DEPLOYMENT_FAILURE_LOG_TAIL_LINES = 30;
const DEPLOYMENT_FAILURE_LOG_LIMIT_BYTES = 16_384;
const DEPLOYMENT_FAILURE_LOG_MAX_CHARS = 4_000;
const DEPLOYMENT_ROLLOUT_DIAGNOSTIC_MAX_CHARS = 8_000;

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

function trimDiagnosticLogTail(value: string): string | null {
  const lines = sanitizeDiagnosticText(value)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  const tail = lines.slice(-DEPLOYMENT_FAILURE_LOG_TAIL_LINES).join('\n');
  if (tail.length <= DEPLOYMENT_FAILURE_LOG_MAX_CHARS) {
    return tail;
  }

  return tail.slice(tail.length - DEPLOYMENT_FAILURE_LOG_MAX_CHARS);
}

async function getDeploymentFailureLogTail(
  namespace: string,
  issue: ReturnType<typeof collectDeploymentPodIssues>[number]
): Promise<string | null> {
  const attempts =
    issue.state === 'waiting'
      ? [
          { previous: true, label: 'previous logs' },
          { previous: false, label: 'current logs' },
        ]
      : [
          { previous: false, label: 'current logs' },
          { previous: true, label: 'previous logs' },
        ];

  for (const attempt of attempts) {
    try {
      const logs = await getPodLogs(namespace, issue.podName, issue.containerName, {
        tailLines: DEPLOYMENT_FAILURE_LOG_TAIL_LINES,
        previous: attempt.previous,
        limitBytes: DEPLOYMENT_FAILURE_LOG_LIMIT_BYTES,
        timestamps: false,
      });
      const tail = trimDiagnosticLogTail(logs);
      if (tail) {
        return `${attempt.label}:\n${tail}`;
      }
    } catch (error) {
      k8sLogger.warn('Could not read failed container logs for deployment readiness diagnostics', {
        namespace,
        podName: issue.podName,
        containerName: issue.containerName,
        previous: attempt.previous,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

async function describeDeploymentPodFailure(input: {
  namespace: string;
  pods: k8s.V1Pod[];
}): Promise<string | null> {
  const issue = collectDeploymentPodIssues(input.pods)[0];
  if (!issue) {
    return null;
  }

  const [eventIssue, logTail] = await Promise.all([
    describeDeploymentEventIssues(input.namespace, input.pods),
    getDeploymentFailureLogTail(input.namespace, issue),
  ]);
  const parts = [formatDeploymentPodIssue(issue)];

  if (eventIssue && !parts.includes(eventIssue)) {
    parts.push(`event: ${eventIssue}`);
  }

  if (logTail) {
    parts.push(logTail);
  }

  return parts.join('\n');
}

function formatDeploymentCondition(condition: k8s.V1DeploymentCondition): string {
  return [condition.type, condition.status, condition.reason, condition.message]
    .filter(Boolean)
    .join(': ');
}

function formatPodContainerStatus(status: k8s.V1ContainerStatus): string {
  const state =
    status.state?.waiting?.reason ??
    status.state?.terminated?.reason ??
    (status.state?.running ? 'Running' : 'Unknown');
  const details = [
    `${status.name}: ${state}`,
    `ready ${status.ready ? 'true' : 'false'}`,
    `restarts ${status.restartCount ?? 0}`,
  ];
  const terminated = status.state?.terminated;
  const waitingMessage = status.state?.waiting?.message;

  if (terminated) {
    details.push(`exit ${terminated.exitCode}`);
  }

  if (waitingMessage) {
    details.push(waitingMessage);
  }

  return details.join(', ');
}

function formatPodDiagnosticSummary(pod: k8s.V1Pod): string {
  const name = pod.metadata?.name ?? 'pod';
  const phase = pod.status?.phase ?? 'Unknown';
  const reason = pod.status?.reason;
  const message = pod.status?.message;
  const containers = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];
  const containerText =
    containers.length > 0 ? containers.map(formatPodContainerStatus).join(' | ') : 'no containers';

  return [`${name}: phase ${phase}`, reason, message, containerText].filter(Boolean).join(' · ');
}

function truncateDeploymentDiagnostic(value: string): string {
  if (value.length <= DEPLOYMENT_ROLLOUT_DIAGNOSTIC_MAX_CHARS) {
    return value;
  }

  return `${value.slice(0, DEPLOYMENT_ROLLOUT_DIAGNOSTIC_MAX_CHARS)}\n...<truncated>`;
}

export async function describeDeploymentRolloutDiagnostics(input: {
  namespace: string;
  name: string;
}): Promise<string> {
  const { apps } = getK8sClient();
  const lines: string[] = [];
  const deployment = await apps.readNamespacedDeployment({
    namespace: input.namespace,
    name: input.name,
  });
  const desiredReplicas = deployment.spec?.replicas ?? 1;
  const updatedReplicas = deployment.status?.updatedReplicas ?? 0;
  const readyReplicas = deployment.status?.readyReplicas ?? 0;
  const availableReplicas = deployment.status?.availableReplicas ?? 0;
  const generation = deployment.metadata?.generation ?? 0;
  const observedGeneration = deployment.status?.observedGeneration ?? 0;

  lines.push(
    `Deployment ${input.name}: generation ${observedGeneration}/${generation}, desired ${desiredReplicas}, updated ${updatedReplicas}, ready ${readyReplicas}, available ${availableReplicas}`
  );

  for (const condition of deployment.status?.conditions ?? []) {
    lines.push(`condition: ${formatDeploymentCondition(condition)}`);
  }

  const deploymentSelector = formatK8sLabelSelector(deployment.spec?.selector?.matchLabels ?? {});
  const replicaSets = await getReplicaSets(input.namespace, deploymentSelector || undefined);
  const activeReplicaSet = selectActiveDeploymentReplicaSet(deployment, replicaSets);

  if (activeReplicaSet) {
    lines.push(`active: ${describeReplicaSetStatus(activeReplicaSet)}`);
  } else {
    lines.push(`active: waiting for current ReplicaSet for ${input.name}`);
  }

  const relatedReplicaSets = replicaSets
    .filter((replicaSet) => replicaSet.metadata?.name !== activeReplicaSet?.metadata?.name)
    .slice(0, 3);
  for (const replicaSet of relatedReplicaSets) {
    lines.push(`related: ${describeReplicaSetStatus(replicaSet)}`);
  }

  const activeReplicaSetSelector = activeReplicaSet
    ? getReplicaSetPodLabelSelector(activeReplicaSet)
    : deploymentSelector;
  const pods = activeReplicaSetSelector
    ? await getPods(input.namespace, activeReplicaSetSelector)
    : [];

  if (pods.length === 0) {
    lines.push(
      `pods: none for selector ${activeReplicaSetSelector || deploymentSelector || 'n/a'}`
    );
  }

  for (const pod of pods) {
    lines.push(`pod: ${formatPodDiagnosticSummary(pod)}`);
  }

  const eventIssue = await describeDeploymentEventIssues(input.namespace, pods);
  if (eventIssue) {
    lines.push(`event: ${eventIssue}`);
  }

  const podIssue = collectDeploymentPodIssues(pods)[0];
  if (podIssue) {
    const logTail = await getDeploymentFailureLogTail(input.namespace, podIssue);
    if (logTail) {
      lines.push(logTail);
    }
  }

  return truncateDeploymentDiagnostic(lines.join('\n'));
}

export async function waitForDeploymentReady(input: {
  namespace: string;
  name: string;
  timeoutMs?: number;
  pollMs?: number;
  minReadyMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? DEFAULT_DEPLOYMENT_ROLLOUT_TIMEOUT_MS;
  const pollMs = input.pollMs ?? 3000;
  const minReadyMs = input.minReadyMs ?? 0;
  const deadline = Date.now() + timeoutMs;
  const { apps } = getK8sClient();
  let lastObservedIssue: string | null = null;
  let readySince: number | null = null;
  let readyReplicaSetUid: string | null = null;

  while (Date.now() < deadline) {
    const deployment = await apps.readNamespacedDeployment({
      namespace: input.namespace,
      name: input.name,
    });

    const generation = deployment.metadata?.generation ?? 0;
    const observedGeneration = deployment.status?.observedGeneration ?? 0;
    if (generation > 0 && observedGeneration < generation) {
      lastObservedIssue = `observed ${observedGeneration}/${generation}`;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    const progressingCondition = deployment.status?.conditions?.find(
      (condition) => condition.type === 'Progressing'
    );
    const progressingFailedMessage =
      progressingCondition?.status === 'False'
        ? (progressingCondition.message ?? 'Deployment rollout failed')
        : null;

    const deploymentSelector = formatK8sLabelSelector(deployment.spec?.selector?.matchLabels ?? {});
    const replicaSets = await getReplicaSets(input.namespace, deploymentSelector || undefined);
    const activeReplicaSet = selectActiveDeploymentReplicaSet(deployment, replicaSets);
    const activeReplicaSetSelector = activeReplicaSet
      ? getReplicaSetPodLabelSelector(activeReplicaSet)
      : null;
    const pods = activeReplicaSetSelector
      ? await getPods(input.namespace, activeReplicaSetSelector)
      : [];
    const podIssue = await describeDeploymentPodFailure({
      namespace: input.namespace,
      pods,
    });
    if (podIssue) {
      throw new Error(podIssue);
    }

    if (progressingFailedMessage) {
      throw new Error(progressingFailedMessage);
    }

    const eventIssue = await describeDeploymentEventIssues(input.namespace, pods);

    if (activeReplicaSet && isReplicaSetReadyForDeployment(deployment, activeReplicaSet)) {
      const activeReplicaSetUid =
        activeReplicaSet.metadata?.uid ?? activeReplicaSet.metadata?.name ?? null;
      if (!readySince || readyReplicaSetUid !== activeReplicaSetUid) {
        readySince = Date.now();
        readyReplicaSetUid = activeReplicaSetUid;
      }

      const readyDurationMs = Date.now() - readySince;
      if (readyDurationMs >= minReadyMs) {
        return;
      }

      lastObservedIssue = `${describeReplicaSetReadiness(
        deployment,
        activeReplicaSet
      )}; waiting ${Math.ceil((minReadyMs - readyDurationMs) / 1000)}s stability window`;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    lastObservedIssue =
      eventIssue ??
      progressingCondition?.message ??
      describeReplicaSetReadiness(deployment, activeReplicaSet);

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const diagnostics = await describeDeploymentRolloutDiagnostics({
    namespace: input.namespace,
    name: input.name,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    return `diagnostics unavailable: ${message}`;
  });

  throw new Error(
    [`Deployment ${input.name} rollout timed out`, lastObservedIssue, diagnostics]
      .filter(Boolean)
      .join('\n')
  );
}

export async function waitForDeploymentObserved(input: {
  namespace: string;
  name: string;
  timeoutMs?: number;
  pollMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 60 * 1000;
  const pollMs = input.pollMs ?? 2000;
  const deadline = Date.now() + timeoutMs;
  const { apps } = getK8sClient();
  let lastObservedIssue: string | null = null;

  while (Date.now() < deadline) {
    const deployment = await apps.readNamespacedDeployment({
      namespace: input.namespace,
      name: input.name,
    });
    const generation = deployment.metadata?.generation ?? 0;
    const observedGeneration = deployment.status?.observedGeneration ?? 0;

    if (generation > 0 && observedGeneration >= generation) {
      return;
    }

    lastObservedIssue = `observed ${observedGeneration}/${generation}`;
    await sleep(pollMs);
  }

  throw new Error(lastObservedIssue ?? `Deployment ${input.name} observation timed out`);
}

export async function verifyServiceReachability(input: {
  namespace: string;
  serviceName: string;
  port: number;
  paths: string[];
  timeoutMs?: number;
  pollMs?: number;
  requestTimeoutMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 30000;
  const pollMs = input.pollMs ?? 2000;
  const requestTimeoutMs = Math.min(input.requestTimeoutMs ?? 8000, timeoutMs);
  const jobName = buildVerificationJobName(input.serviceName);
  const attemptCount = Math.max(1, Math.ceil(timeoutMs / pollMs));
  const sleepSeconds = Math.max(1, Math.ceil(pollMs / 1000));
  const requestTimeoutSeconds = Math.max(1, Math.ceil(requestTimeoutMs / 1000));
  const script = buildServiceVerificationScript({
    serviceName: input.serviceName,
    port: input.port,
    paths: input.paths,
    attemptCount,
    sleepSeconds,
    requestTimeoutSeconds,
  });

  const job = buildPlatformOperationJob({
    namespace: input.namespace,
    name: jobName,
    component: 'service-verification',
    labels: {
      'juanie.io/service': input.serviceName,
    },
    podLabels: {
      'juanie.io/service': input.serviceName,
    },
    automountServiceAccountToken: false,
    ttlSecondsAfterFinished: 600,
    containers: [
      {
        name: 'curl',
        image: SERVICE_VERIFY_IMAGE,
        command: ['/bin/sh', '-lc', script],
        securityContext: {
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ['ALL'],
          },
        },
      },
    ],
  });

  await submitPlatformOperationJob({
    namespace: input.namespace,
    job,
    replaceExisting: true,
  });

  try {
    const snapshot = await waitForPlatformOperationJob({
      namespace: input.namespace,
      name: jobName,
      containerName: 'curl',
      timeoutMs: timeoutMs + requestTimeoutMs + pollMs,
      timeoutMessage: `Service verify timed out for ${input.serviceName}`,
      pollIntervalMs: pollMs,
    });

    if (snapshot.status !== 'succeeded') {
      throw new Error(
        `Service verify failed for ${input.serviceName}: ${
          snapshot.message ?? 'verification job failed'
        }`
      );
    }
  } finally {
    await deletePlatformOperationJob({
      namespace: input.namespace,
      name: jobName,
    }).catch(() => undefined);
  }
}

export async function getDeploymentSnapshot(
  namespace: string,
  name: string
): Promise<DeploymentSnapshot | null> {
  const { apps } = getK8sClient();

  try {
    const current = await apps.readNamespacedDeployment({ namespace, name });
    const container = current.spec?.template?.spec?.containers?.[0];

    if (!container) {
      return null;
    }

    return {
      image: container.image ?? null,
      replicas: current.spec?.replicas ?? 1,
      command: container.command ?? [],
      args: container.args ?? [],
      env: container.env
        ?.filter((item) => item.name && item.value !== undefined)
        .reduce<Record<string, string>>((env, item) => {
          env[item.name!] = item.value!;
          return env;
        }, {}),
      envFrom:
        container.envFrom?.map((item) => ({
          ...(item.secretRef?.name ? { secretRef: { name: item.secretRef.name } } : {}),
          ...(item.configMapRef?.name ? { configMapRef: { name: item.configMapRef.name } } : {}),
        })) ?? undefined,
      imagePullSecrets: current.spec?.template?.spec?.imagePullSecrets
        ?.map((item) => item.name)
        .filter(Boolean) as string[] | undefined,
      port: container.ports?.[0]?.containerPort ?? 3000,
      cpuRequest: container.resources?.requests?.cpu,
      cpuLimit: container.resources?.limits?.cpu,
      memoryRequest: container.resources?.requests?.memory,
      memoryLimit: container.resources?.limits?.memory,
    };
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return null;
    }

    throw e;
  }
}
