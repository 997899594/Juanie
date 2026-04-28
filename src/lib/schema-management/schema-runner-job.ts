import type { V1Job } from '@kubernetes/client-node';
import { createJob, deleteJob, getJob, getPodLogs, getPods, isK8sAvailable } from '@/lib/k8s';

export type SchemaRunnerMode = 'schema-repair' | 'inspect' | 'migration';
export type SchemaRunnerJobStatus = 'missing' | 'running' | 'succeeded' | 'failed';

interface SchemaRunnerJobInput {
  namespace: string;
  jobName: string;
  image: string;
  mode: SchemaRunnerMode;
  env?: Array<{
    name: string;
    value: string;
  }>;
  labels?: Record<string, string>;
  waitForRedis?: boolean;
}

function buildSchemaRunnerCommand(mode: SchemaRunnerMode): string[] {
  if (mode === 'inspect') {
    return ['./schema-runner', 'inspect'];
  }

  if (mode === 'migration') {
    return ['./schema-runner', 'migration'];
  }

  return ['./schema-runner'];
}

export function resolveSchemaRunnerImage(): string | null {
  return [process.env.SCHEMA_RUNNER_IMAGE_REPOSITORY, process.env.SCHEMA_RUNNER_IMAGE_TAG].every(
    Boolean
  )
    ? `${process.env.SCHEMA_RUNNER_IMAGE_REPOSITORY}:${process.env.SCHEMA_RUNNER_IMAGE_TAG}`
    : null;
}

export function canUseSchemaRunnerJobs(): boolean {
  return isK8sAvailable() && Boolean(resolveSchemaRunnerImage());
}

export function buildSchemaRunnerJob(input: SchemaRunnerJobInput): V1Job {
  const initContainers = [
    {
      name: 'wait-for-postgres',
      image: 'busybox:1.36',
      command: [
        'sh',
        '-c',
        'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done',
      ],
    },
  ];

  if (input.waitForRedis !== false) {
    initContainers.push({
      name: 'wait-for-redis',
      image: 'busybox:1.36',
      command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done'],
    });
  }

  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: input.jobName,
      namespace: input.namespace,
      labels: {
        'app.kubernetes.io/name': 'juanie',
        'app.kubernetes.io/component': 'schema-runner',
        ...(input.labels ?? {}),
      },
    },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 3600,
      template: {
        metadata: {
          labels: {
            'job-name': input.jobName,
            ...(input.labels ?? {}),
          },
        },
        spec: {
          restartPolicy: 'Never',
          serviceAccountName: 'juanie',
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1001,
            fsGroup: 1001,
          },
          initContainers,
          containers: [
            {
              name: 'schema-runner',
              image: input.image,
              imagePullPolicy: 'IfNotPresent',
              command: buildSchemaRunnerCommand(input.mode),
              envFrom: [
                {
                  configMapRef: {
                    name: 'juanie-config',
                  },
                },
                {
                  secretRef: {
                    name: 'juanie-secret',
                  },
                },
              ],
              env: input.env?.map((item) => ({
                name: item.name,
                value: item.value,
              })),
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: {
                  drop: ['ALL'],
                },
              },
              resources: {
                requests: {
                  cpu: '25m',
                  memory: '96Mi',
                },
              },
            },
          ],
        },
      },
    },
  } satisfies V1Job;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJobConditionMessage(job: V1Job, type: 'Complete' | 'Failed'): string | null {
  const condition = job.status?.conditions?.find(
    (item) => item.type === type && item.status === 'True'
  );
  return condition?.message ?? condition?.reason ?? null;
}

function isK8sNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number };
  return (candidate.code ?? candidate.statusCode) === 404;
}

function isK8sConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number };
  return (candidate.code ?? candidate.statusCode) === 409;
}

async function readSchemaRunnerJobFailure(
  namespace: string,
  jobName: string,
  fallback: string
): Promise<string> {
  const pods = await getPods(namespace, `job-name=${jobName}`);
  const pod = pods[0];

  if (!pod?.metadata?.name) {
    return fallback;
  }

  const podReason =
    pod.status?.message ??
    pod.status?.reason ??
    pod.status?.containerStatuses?.find((status) => status.state?.terminated)?.state?.terminated
      ?.message ??
    pod.status?.containerStatuses?.find((status) => status.state?.waiting)?.state?.waiting
      ?.message ??
    pod.status?.initContainerStatuses?.find((status) => status.state?.terminated)?.state?.terminated
      ?.message ??
    pod.status?.initContainerStatuses?.find((status) => status.state?.waiting)?.state?.waiting
      ?.message;

  try {
    const logs = await getPodLogs(namespace, pod.metadata.name, 'schema-runner', 200, false);
    const trimmedLogs = logs.trim();

    if (trimmedLogs.length > 0) {
      return `${fallback}\n${trimmedLogs}`;
    }
  } catch {
    // Ignore log read failures and fall back to pod/job status below.
  }

  return podReason ? `${fallback}\n${podReason}` : fallback;
}

export async function getSchemaRunnerJobStatus(input: {
  namespace?: string;
  jobName: string;
}): Promise<{
  status: SchemaRunnerJobStatus;
  message: string | null;
}> {
  const namespace = input.namespace ?? process.env.JUANIE_NAMESPACE ?? 'juanie';

  try {
    const job = await getJob(namespace, input.jobName);

    if (getJobConditionMessage(job, 'Complete')) {
      return {
        status: 'succeeded',
        message: getJobConditionMessage(job, 'Complete'),
      };
    }

    const failedMessage = getJobConditionMessage(job, 'Failed');
    if (failedMessage) {
      return {
        status: 'failed',
        message: await readSchemaRunnerJobFailure(namespace, input.jobName, failedMessage),
      };
    }

    return {
      status: 'running',
      message: null,
    };
  } catch (error) {
    if (isK8sNotFoundError(error)) {
      return {
        status: 'missing',
        message: null,
      };
    }

    throw error;
  }
}

export async function runSchemaRunnerJobAndWait(input: {
  namespace?: string;
  jobName: string;
  mode: SchemaRunnerMode;
  env?: Array<{
    name: string;
    value: string;
  }>;
  labels?: Record<string, string>;
  waitForRedis?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  const namespace = input.namespace ?? process.env.JUANIE_NAMESPACE ?? 'juanie';
  const image = resolveSchemaRunnerImage();
  if (!isK8sAvailable()) {
    throw new Error('Schema runner execution requires Kubernetes connectivity');
  }
  if (!image) {
    throw new Error('SCHEMA_RUNNER_IMAGE_REPOSITORY and SCHEMA_RUNNER_IMAGE_TAG are required');
  }

  let ownsJob = false;

  try {
    const existingStatus = await getSchemaRunnerJobStatus({
      namespace,
      jobName: input.jobName,
    });

    if (existingStatus.status === 'failed') {
      await deleteJob(namespace, input.jobName).catch(() => undefined);
    }

    if (existingStatus.status === 'missing' || existingStatus.status === 'failed') {
      try {
        await createJob(
          namespace,
          buildSchemaRunnerJob({
            namespace,
            jobName: input.jobName,
            image,
            mode: input.mode,
            env: input.env,
            labels: input.labels,
            waitForRedis: input.waitForRedis,
          })
        );
        ownsJob = true;
      } catch (error) {
        if (!isK8sConflictError(error)) {
          throw error;
        }
      }
    }

    const timeoutMs = input.timeoutMs ?? 240_000;
    const pollIntervalMs = input.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await getSchemaRunnerJobStatus({
        namespace,
        jobName: input.jobName,
      });

      if (status.status === 'missing') {
        return;
      }

      if (status.status === 'succeeded') {
        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.message ?? `Schema runner job ${input.jobName} 执行失败`);
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(`Schema runner job ${input.jobName} 超时，超过 ${timeoutMs}ms 仍未完成`);
  } finally {
    if (ownsJob) {
      await deleteJob(namespace, input.jobName).catch(() => undefined);
    }
  }
}
