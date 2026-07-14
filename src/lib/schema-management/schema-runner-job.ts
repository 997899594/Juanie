import type { V1Job } from '@kubernetes/client-node';
import {
  buildPlatformOperationJob,
  deletePlatformOperationJob,
  ensurePlatformOperationJob,
  getPlatformOperationJobSnapshot,
  isK8sAvailable,
  submitPlatformOperationJob,
  waitForPlatformOperationJob,
} from '@/lib/k8s';

export type SchemaRunnerMode = 'schema-repair' | 'inspect' | 'migration';
export type SchemaRunnerJobStatus = 'missing' | 'running' | 'succeeded' | 'failed';
export type SchemaRunnerJobStartStatus = 'queued' | 'running';

const defaultSchemaRunnerTimeoutMsByMode: Record<SchemaRunnerMode, number> = {
  inspect: 600_000,
  migration: 600_000,
  'schema-repair': 600_000,
};

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

function resolveSchemaRunnerNamespace(namespace?: string): string {
  return namespace ?? process.env.JUANIE_NAMESPACE ?? 'juanie';
}

export function resolveSchemaRunnerImage(): string | null {
  return [process.env.SCHEMA_RUNNER_IMAGE_REPOSITORY, process.env.SCHEMA_RUNNER_IMAGE_TAG].every(
    Boolean
  )
    ? `${process.env.SCHEMA_RUNNER_IMAGE_REPOSITORY}:${process.env.SCHEMA_RUNNER_IMAGE_TAG}`
    : null;
}

function requireSchemaRunnerImage(): string {
  const image = resolveSchemaRunnerImage();
  if (!image) {
    throw new Error('SCHEMA_RUNNER_IMAGE_REPOSITORY and SCHEMA_RUNNER_IMAGE_TAG are required');
  }

  return image;
}

function requireSchemaRunnerJobSupport(context: string): string {
  if (!isK8sAvailable()) {
    throw new Error(`${context} requires Kubernetes connectivity`);
  }

  return requireSchemaRunnerImage();
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

  return buildPlatformOperationJob({
    namespace: input.namespace,
    name: input.jobName,
    component: 'schema-runner',
    labels: input.labels,
    automountServiceAccountToken: false,
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
  }) satisfies V1Job;
}

export async function getSchemaRunnerJobStatus(input: {
  namespace?: string;
  jobName: string;
}): Promise<{
  status: SchemaRunnerJobStatus;
  message: string | null;
}> {
  const namespace = resolveSchemaRunnerNamespace(input.namespace);
  const snapshot = await getPlatformOperationJobSnapshot({
    namespace,
    name: input.jobName,
    containerName: 'schema-runner',
  });

  return {
    status: snapshot.status,
    message: snapshot.message,
  };
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
  const namespace = resolveSchemaRunnerNamespace(input.namespace);
  const image = requireSchemaRunnerJobSupport('Schema runner execution');
  let ownsJob = false;

  try {
    const ensured = await ensurePlatformOperationJob({
      namespace,
      job: buildSchemaRunnerJob({
        namespace,
        jobName: input.jobName,
        image,
        mode: input.mode,
        env: input.env,
        labels: input.labels,
        waitForRedis: input.waitForRedis,
      }),
      replaceStatuses: ['succeeded', 'failed'],
      containerName: 'schema-runner',
    });
    ownsJob = ensured.created;

    const timeoutMs = input.timeoutMs ?? defaultSchemaRunnerTimeoutMsByMode[input.mode];
    const status = await waitForPlatformOperationJob({
      namespace,
      name: input.jobName,
      containerName: 'schema-runner',
      timeoutMs,
      timeoutMessage: `Schema runner job ${input.jobName} 超时，超过 ${timeoutMs}ms 仍未完成`,
      pollIntervalMs: input.pollIntervalMs,
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

    throw new Error(`Schema runner job ${input.jobName} 超时，超过 ${timeoutMs}ms 仍未完成`);
  } finally {
    if (ownsJob) {
      await deletePlatformOperationJob({
        namespace,
        name: input.jobName,
      }).catch(() => undefined);
    }
  }
}

export async function startSchemaRunnerJob(input: {
  namespace?: string;
  jobName: string;
  mode: SchemaRunnerMode;
  env?: Array<{
    name: string;
    value: string;
  }>;
  labels?: Record<string, string>;
  waitForRedis?: boolean;
}): Promise<{
  status: SchemaRunnerJobStartStatus;
  message: string | null;
}> {
  const namespace = resolveSchemaRunnerNamespace(input.namespace);
  const image = requireSchemaRunnerJobSupport('Schema runner execution');

  const submitted = await ensurePlatformOperationJob({
    namespace,
    job: buildSchemaRunnerJob({
      namespace,
      jobName: input.jobName,
      image,
      mode: input.mode,
      env: input.env,
      labels: input.labels,
      waitForRedis: input.waitForRedis,
    }),
    replaceStatuses: ['succeeded', 'failed'],
    containerName: 'schema-runner',
  });

  return {
    status: submitted.created ? 'queued' : 'running',
    message: submitted.message,
  };
}

export async function replaceSchemaRunnerJob(input: {
  namespace?: string;
  jobName: string;
  mode: SchemaRunnerMode;
  env?: Array<{
    name: string;
    value: string;
  }>;
  labels?: Record<string, string>;
  waitForRedis?: boolean;
}): Promise<void> {
  const namespace = resolveSchemaRunnerNamespace(input.namespace);
  const image = requireSchemaRunnerJobSupport('Schema runner execution');

  await submitPlatformOperationJob({
    namespace,
    job: buildSchemaRunnerJob({
      namespace,
      jobName: input.jobName,
      image,
      mode: input.mode,
      env: input.env,
      labels: input.labels,
      waitForRedis: input.waitForRedis,
    }),
    replaceExisting: true,
  });
}
