import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s/client';
import { getPodLogs, getPods } from '@/lib/k8s/core-resources';
import { isK8sConflictError, isK8sNotFoundError } from '@/lib/k8s/errors';
import { getPodStatusMessage } from '@/lib/k8s/pod-diagnostics';

async function createJob(namespace: string, body: k8s.V1Job): Promise<void> {
  const { batch } = getK8sClient();
  await batch.createNamespacedJob({ namespace, body });
}

export type PlatformOperationJobStatus = 'missing' | 'running' | 'succeeded' | 'failed';

export interface PlatformOperationJobSnapshot {
  status: PlatformOperationJobStatus;
  message: string | null;
  logs: string | null;
  job: k8s.V1Job | null;
  pod: k8s.V1Pod | null;
}

export interface PlatformOperationJobInput {
  namespace: string;
  name: string;
  component: string;
  labels?: Record<string, string>;
  podLabels?: Record<string, string>;
  serviceAccountName?: string;
  automountServiceAccountToken?: boolean;
  backoffLimit?: number;
  ttlSecondsAfterFinished?: number;
  restartPolicy?: 'Never' | 'OnFailure';
  securityContext?: k8s.V1PodSecurityContext;
  initContainers?: k8s.V1Container[];
  containers: k8s.V1Container[];
  imagePullSecrets?: k8s.V1LocalObjectReference[];
  volumes?: k8s.V1Volume[];
}

export function buildPlatformOperationJob(input: PlatformOperationJobInput): k8s.V1Job {
  const labels = {
    'app.kubernetes.io/name': 'juanie',
    'app.kubernetes.io/managed-by': 'juanie',
    'app.kubernetes.io/component': input.component,
    ...(input.labels ?? {}),
  };

  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels,
    },
    spec: {
      backoffLimit: input.backoffLimit ?? 0,
      ttlSecondsAfterFinished: input.ttlSecondsAfterFinished ?? 3600,
      template: {
        metadata: {
          labels: {
            ...labels,
            'job-name': input.name,
            ...(input.podLabels ?? {}),
          },
        },
        spec: {
          restartPolicy: input.restartPolicy ?? 'Never',
          serviceAccountName: input.serviceAccountName,
          automountServiceAccountToken: input.automountServiceAccountToken ?? false,
          securityContext: input.securityContext,
          initContainers: input.initContainers,
          containers: input.containers,
          imagePullSecrets: input.imagePullSecrets,
          volumes: input.volumes,
        },
      },
    },
  };
}

async function getJob(namespace: string, name: string): Promise<k8s.V1Job> {
  const { batch } = getK8sClient();
  return batch.readNamespacedJob({ namespace, name });
}

async function deleteJob(namespace: string, name: string): Promise<void> {
  const { batch } = getK8sClient();
  try {
    await batch.deleteNamespacedJob({
      namespace,
      name,
      body: {
        propagationPolicy: 'Background',
      },
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

function getJobCondition(job: k8s.V1Job, type: 'Complete' | 'Failed'): k8s.V1JobCondition | null {
  return (
    job.status?.conditions?.find((item) => item.type === type && item.status === 'True') ?? null
  );
}

export function getPlatformOperationPodTerminalStatus(
  pod: k8s.V1Pod | null
): Extract<PlatformOperationJobStatus, 'succeeded' | 'failed'> | null {
  if (!pod) {
    return null;
  }

  if (pod.status?.phase === 'Succeeded') {
    return 'succeeded';
  }

  if (pod.status?.phase === 'Failed') {
    return 'failed';
  }

  const statuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];
  if (statuses.length === 0 || statuses.some((status) => !status.state?.terminated)) {
    return null;
  }

  return statuses.every((status) => status.state?.terminated?.exitCode === 0)
    ? 'succeeded'
    : 'failed';
}

async function waitForJobDeleted(input: {
  namespace: string;
  name: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  const deadline = Date.now() + (input.timeoutMs ?? 15_000);
  const pollIntervalMs = input.pollIntervalMs ?? 500;

  while (Date.now() < deadline) {
    try {
      await getJob(input.namespace, input.name);
    } catch (error) {
      if (isK8sNotFoundError(error)) {
        return;
      }

      throw error;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Operation job ${input.namespace}/${input.name} is still terminating`);
}

export async function deletePlatformOperationJob(input: {
  namespace: string;
  name: string;
  waitForDeletion?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  await deleteJob(input.namespace, input.name);

  if (input.waitForDeletion) {
    await waitForJobDeleted({
      namespace: input.namespace,
      name: input.name,
      timeoutMs: input.timeoutMs,
      pollIntervalMs: input.pollIntervalMs,
    });
  }
}

export async function getPlatformOperationJobSnapshot(input: {
  namespace: string;
  name: string;
  containerName?: string;
  tailLines?: number;
}): Promise<PlatformOperationJobSnapshot> {
  try {
    const job = await getJob(input.namespace, input.name);
    const pods = await getPods(input.namespace, `job-name=${input.name}`).catch(() => []);
    const pod = pods[0] ?? null;
    const completeCondition = getJobCondition(job, 'Complete');
    const failedCondition = getJobCondition(job, 'Failed');
    const podTerminalStatus = getPlatformOperationPodTerminalStatus(pod);
    const terminal = Boolean(completeCondition || failedCondition || podTerminalStatus);
    const logs =
      terminal && pod?.metadata?.name
        ? (
            await getPodLogs(
              input.namespace,
              pod.metadata.name,
              input.containerName,
              input.tailLines ?? 200,
              false
            ).catch(() => '')
          ).trim() || null
        : null;

    if (completeCondition || podTerminalStatus === 'succeeded') {
      return {
        status: 'succeeded',
        message: completeCondition?.message ?? completeCondition?.reason ?? logs,
        logs,
        job,
        pod,
      };
    }

    if (failedCondition || podTerminalStatus === 'failed') {
      return {
        status: 'failed',
        message:
          logs ??
          (pod ? getPodStatusMessage(pod) : null) ??
          failedCondition?.message ??
          failedCondition?.reason ??
          'operation job failed',
        logs,
        job,
        pod,
      };
    }

    return {
      status: 'running',
      message: pod ? getPodStatusMessage(pod) : null,
      logs: null,
      job,
      pod,
    };
  } catch (error) {
    if (isK8sNotFoundError(error)) {
      return {
        status: 'missing',
        message: null,
        logs: null,
        job: null,
        pod: null,
      };
    }

    throw error;
  }
}

export async function submitPlatformOperationJob(input: {
  namespace: string;
  job: k8s.V1Job;
  replaceExisting?: boolean;
}): Promise<{ status: 'queued' | 'running'; created: boolean }> {
  const jobName = input.job.metadata?.name;
  if (!jobName) {
    throw new Error('Operation job metadata.name is required');
  }

  if (input.replaceExisting) {
    await deletePlatformOperationJob({
      namespace: input.namespace,
      name: jobName,
      waitForDeletion: true,
      timeoutMs: 30_000,
      pollIntervalMs: 500,
    });
  }

  try {
    await createJob(input.namespace, input.job);
    return { status: 'queued', created: true };
  } catch (error) {
    if (input.replaceExisting && isK8sConflictError(error)) {
      await waitForJobDeleted({
        namespace: input.namespace,
        name: jobName,
        timeoutMs: 30_000,
        pollIntervalMs: 500,
      });
      await createJob(input.namespace, input.job);
      return { status: 'queued', created: true };
    }

    if (isK8sConflictError(error)) {
      return { status: 'running', created: false };
    }

    throw error;
  }
}

export async function ensurePlatformOperationJob(input: {
  namespace: string;
  job: k8s.V1Job;
  replaceStatuses?: PlatformOperationJobStatus[];
  containerName?: string;
}): Promise<{ status: 'queued' | 'running'; created: boolean; message: string | null }> {
  const jobName = input.job.metadata?.name;
  if (!jobName) {
    throw new Error('Operation job metadata.name is required');
  }

  const snapshot = await getPlatformOperationJobSnapshot({
    namespace: input.namespace,
    name: jobName,
    containerName: input.containerName,
  });
  const shouldReplace = input.replaceStatuses?.includes(snapshot.status) ?? false;

  if (snapshot.status === 'missing' || shouldReplace) {
    const submitted = await submitPlatformOperationJob({
      namespace: input.namespace,
      job: input.job,
      replaceExisting: shouldReplace,
    });
    return {
      ...submitted,
      message: null,
    };
  }

  return {
    status: 'running',
    created: false,
    message: snapshot.message,
  };
}

export async function waitForPlatformOperationJob(input: {
  namespace: string;
  name: string;
  containerName?: string;
  tailLines?: number;
  timeoutMs: number;
  timeoutMessage?: string;
  pollIntervalMs?: number;
}): Promise<PlatformOperationJobSnapshot> {
  const pollIntervalMs = input.pollIntervalMs ?? 2000;
  const deadline = Date.now() + input.timeoutMs;
  let lastSnapshot: PlatformOperationJobSnapshot | null = null;

  while (Date.now() < deadline) {
    const snapshot = await getPlatformOperationJobSnapshot({
      namespace: input.namespace,
      name: input.name,
      containerName: input.containerName,
      tailLines: input.tailLines,
    });

    if (snapshot.status !== 'running') {
      return snapshot;
    }

    lastSnapshot = snapshot;
    await sleep(pollIntervalMs);
  }

  const fallbackMessage = `Operation job ${input.namespace}/${input.name} timed out`;
  if (input.timeoutMessage) {
    throw new Error(
      lastSnapshot?.message
        ? `${input.timeoutMessage}: ${lastSnapshot.message}`
        : input.timeoutMessage
    );
  }

  throw new Error(lastSnapshot?.message ?? fallbackMessage);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
