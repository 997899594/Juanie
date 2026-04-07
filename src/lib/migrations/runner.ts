import crypto from 'node:crypto';
import type { CoreV1Event, V1EnvVar, V1Job, V1Pod } from '@kubernetes/client-node';
import { and, eq, inArray } from 'drizzle-orm';
import {
  formatDatabaseCapabilityIssues,
  verifyDeclaredDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import { ensureManagedPostgresOwnership } from '@/lib/databases/postgres-ownership';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import { getDeployRegistryPullSecretName, usesDeployRegistryImage } from '@/lib/deploy-registry';
import {
  createJob,
  deleteJob,
  ensureDeployRegistryImagePullAccess,
  getEvents,
  getIsConnected,
  getJob,
  getPodLogs,
  getPods,
} from '@/lib/k8s';
import { executeMigrationsForDatabase } from '@/lib/migrations/executor';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { evaluateMigrationPolicy } from '@/lib/policies/delivery';
import { assessMigrationCommandSafety } from './command-safety';
import type { ExecuteMigrationRunOptions, ResolvedMigrationSpec } from './types';

type MigrationRunRecord = typeof migrationRuns.$inferSelect;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

const MIGRATION_STARTUP_TIMEOUT_MS = 15 * 60 * 1000;
const MIGRATION_EXECUTION_TIMEOUT_MS = 20 * 60 * 1000;
const ACTIVE_MIGRATION_RUN_STATUSES = ['queued', 'planning', 'running'] as const;
const ACTIVE_MIGRATION_ITEM_STATUSES = ['queued', 'planning', 'running'] as const;

function buildDatabaseEnvVars(spec: ResolvedMigrationSpec): V1EnvVar[] {
  const envVars: V1EnvVar[] = [];
  const { database } = spec;

  if (database.connectionString) {
    envVars.push({ name: 'DATABASE_URL', value: database.connectionString });
  }
  if (database.host) envVars.push({ name: 'DB_HOST', value: database.host });
  if (database.port) envVars.push({ name: 'DB_PORT', value: String(database.port) });
  if (database.databaseName) envVars.push({ name: 'DB_NAME', value: database.databaseName });
  if (database.username) envVars.push({ name: 'DB_USER', value: database.username });
  if (database.password) envVars.push({ name: 'DB_PASSWORD', value: database.password });

  return envVars;
}

async function appendRunLog(runId: string, message: string): Promise<void> {
  const existing = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
  });
  const next = [existing?.logExcerpt ?? '', message].filter(Boolean).join('\n').slice(-8000);
  await db
    .update(migrationRuns)
    .set({ logExcerpt: next, updatedAt: new Date() })
    .where(eq(migrationRuns.id, runId));
}

function isRetryablePodLogError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode =
    typeof error === 'object' && error !== null
      ? ((error as { code?: number; statusCode?: number }).code ??
        (error as { code?: number; statusCode?: number }).statusCode)
      : undefined;

  return (
    statusCode === 400 ||
    statusCode === 404 ||
    message.includes('ContainerCreating') ||
    message.includes('waiting to start') ||
    message.includes('is waiting') ||
    message.includes('BadRequest') ||
    message.includes('Error occurred in log request')
  );
}

async function tryGetPodLogs(
  namespace: string,
  podName: string,
  runId: string
): Promise<string | null> {
  try {
    return await getPodLogs(namespace, podName, undefined, 200);
  } catch (error) {
    if (isRetryablePodLogError(error)) {
      await appendRunLog(runId, '迁移容器仍在启动，等待日志可读...');
      return null;
    }

    throw error;
  }
}

function getMigrationPodPhase(pod?: V1Pod) {
  return pod?.status?.phase ?? 'Pending';
}

function getMigrationContainerStatus(pod?: V1Pod) {
  return pod?.status?.containerStatuses?.[0];
}

function getKubernetesApiErrorDetails(error: unknown): {
  statusCode: number | null;
  message: string;
} {
  const statusCode =
    typeof error === 'object' && error !== null
      ? Number(
          (error as { statusCode?: number; code?: number }).statusCode ??
            (error as { statusCode?: number; code?: number }).code ??
            NaN
        )
      : NaN;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    message,
  };
}

function isKubernetesApiStatus(error: unknown, expectedStatus: number): boolean {
  const details = getKubernetesApiErrorDetails(error);
  return details.statusCode === expectedStatus;
}

function isJobAlreadyExistsError(error: unknown): boolean {
  const details = getKubernetesApiErrorDetails(error);
  return details.statusCode === 409 || details.message.toLowerCase().includes('already exists');
}

function classifyMigrationJobCreateError(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  const details = getKubernetesApiErrorDetails(error);
  const normalized = details.message.toLowerCase();

  if (
    details.statusCode === 403 ||
    normalized.includes('forbidden') ||
    normalized.includes('cannot create resource "jobs"')
  ) {
    return {
      errorCode: 'MIGRATION_RUNNER_RBAC_DENIED',
      errorMessage:
        'Platform service account cannot create migration jobs in the target namespace. Check Juanie RBAC for batch/jobs.',
    };
  }

  if (
    details.statusCode === 404 ||
    (normalized.includes('namespaces') && normalized.includes('not found'))
  ) {
    return {
      errorCode: 'MIGRATION_NAMESPACE_NOT_FOUND',
      errorMessage: 'Target namespace for migration job does not exist yet.',
    };
  }

  return {
    errorCode: 'MIGRATION_JOB_CREATE_FAILED',
    errorMessage: details.message || 'Failed to create migration job',
  };
}

async function getExistingJob(namespace: string, jobName: string): Promise<V1Job | null> {
  try {
    return await getJob(namespace, jobName);
  } catch (error) {
    if (isKubernetesApiStatus(error, 404)) {
      return null;
    }

    throw error;
  }
}

async function ensureCommandMigrationItem(
  runId: string,
  command: string,
  checksum: string
): Promise<typeof migrationRunItems.$inferSelect> {
  const existing = await db.query.migrationRunItems.findFirst({
    where: eq(migrationRunItems.migrationRunId, runId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (
    existing &&
    existing.name === command &&
    existing.checksum === checksum &&
    ['queued', 'planning', 'running'].includes(existing.status)
  ) {
    const startedAt = existing.startedAt ?? new Date();
    if (
      existing.status !== 'running' ||
      !existing.startedAt ||
      existing.finishedAt ||
      existing.error
    ) {
      await db
        .update(migrationRunItems)
        .set({
          status: 'running',
          startedAt,
          finishedAt: null,
          error: null,
        })
        .where(eq(migrationRunItems.id, existing.id));
    }

    return {
      ...existing,
      status: 'running',
      startedAt,
      finishedAt: null,
      error: null,
    };
  }

  const [item] = await db
    .insert(migrationRunItems)
    .values({
      migrationRunId: runId,
      name: command,
      checksum,
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  return item;
}

function getMigrationPodIssue(pod?: V1Pod): string | null {
  const containerStatus = getMigrationContainerStatus(pod);
  const waiting = containerStatus?.state?.waiting;
  const terminated = containerStatus?.state?.terminated;

  if (
    waiting?.reason &&
    ['ErrImagePull', 'ImagePullBackOff', 'CrashLoopBackOff'].includes(waiting.reason)
  ) {
    return waiting.message ? `${waiting.reason}: ${waiting.message}` : waiting.reason;
  }

  if (terminated?.reason) {
    if (terminated.reason === 'Completed' || terminated.exitCode === 0) {
      return null;
    }

    return terminated.message ? `${terminated.reason}: ${terminated.message}` : terminated.reason;
  }

  return null;
}

function getEventTimestamp(event: CoreV1Event): number {
  const value =
    event.eventTime ??
    (event as { lastTimestamp?: Date | string | null }).lastTimestamp ??
    (event as { firstTimestamp?: Date | string | null }).firstTimestamp ??
    event.metadata?.creationTimestamp ??
    null;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function describeMigrationEventIssue(event: CoreV1Event): {
  errorCode: string;
  errorMessage: string;
} | null {
  const reason = event.reason ?? '';
  const message = event.message?.trim() ?? '';
  const normalized = `${reason} ${message}`.toLowerCase();

  if (reason === 'FailedScheduling' || normalized.includes('insufficient')) {
    return {
      errorCode: 'MIGRATION_CAPACITY_BLOCKED',
      errorMessage: `Migration job could not be scheduled: ${message || 'insufficient cluster capacity'}`,
    };
  }

  if (
    reason === 'FailedToRetrieveImagePullSecret' ||
    normalized.includes('pull secret') ||
    normalized.includes('failedtoretrieveimagepullsecret')
  ) {
    return {
      errorCode: 'MIGRATION_IMAGE_PULL_SECRET_UNAVAILABLE',
      errorMessage: `Migration job image pull secret is unavailable: ${message || reason}`,
    };
  }

  if (
    normalized.includes('errimagepull') ||
    normalized.includes('imagepullbackoff') ||
    normalized.includes('failed to pull image') ||
    normalized.includes('back-off pulling image')
  ) {
    return {
      errorCode: 'MIGRATION_IMAGE_PULL_FAILED',
      errorMessage: `Migration job image pull failed: ${message || reason}`,
    };
  }

  if (reason === 'Pulling' || normalized.includes('pulling image')) {
    return {
      errorCode: 'MIGRATION_IMAGE_PULL_TIMEOUT',
      errorMessage: `Migration job image pull timed out: ${message || 'image is still being pulled'}`,
    };
  }

  if (reason === 'BackOff' || normalized.includes('crashloopbackoff')) {
    return {
      errorCode: 'MIGRATION_RUNTIME_UNHEALTHY',
      errorMessage: `Migration job container failed to start cleanly: ${message || reason}`,
    };
  }

  return null;
}

function isMigrationContainerRunning(pod?: V1Pod): boolean {
  return Boolean(getMigrationContainerStatus(pod)?.state?.running);
}

async function getRunStartedAt(runId: string): Promise<Date | null> {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    columns: { startedAt: true },
  });
  return run?.startedAt ?? null;
}

async function failDetachedK8sMigrationRun(
  runId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const finishedAt = new Date();
  const startedAt = await getRunStartedAt(runId);

  await db
    .update(migrationRunItems)
    .set({
      status: 'failed',
      error: errorMessage,
      output: errorMessage,
      finishedAt,
    })
    .where(
      and(
        eq(migrationRunItems.migrationRunId, runId),
        inArray(migrationRunItems.status, [...ACTIVE_MIGRATION_ITEM_STATUSES])
      )
    );

  await db
    .update(migrationRuns)
    .set({
      status: 'failed',
      errorCode,
      errorMessage,
      finishedAt,
      durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
      updatedAt: finishedAt,
    })
    .where(eq(migrationRuns.id, runId));

  await appendRunLog(runId, errorMessage);
}

async function reconcileDetachedK8sMigrationRun(
  run: MigrationRunRecord,
  namespace: string | null | undefined
): Promise<boolean> {
  if (run.runnerType !== 'k8s_job') {
    return false;
  }

  if (
    !ACTIVE_MIGRATION_RUN_STATUSES.includes(
      run.status as (typeof ACTIVE_MIGRATION_RUN_STATUSES)[number]
    )
  ) {
    return false;
  }

  if (!namespace) {
    return false;
  }

  const jobName = `migration-${run.id.slice(0, 8)}`;
  const job = await getExistingJob(namespace, jobName);

  if (!job) {
    await failDetachedK8sMigrationRun(
      run.id,
      'MIGRATION_RUNNER_JOB_MISSING',
      `Migration job ${jobName} no longer exists in namespace ${namespace}`
    );
    return true;
  }

  const failed = (job.status?.conditions ?? []).some(
    (condition) => condition.type === 'Failed' && condition.status === 'True'
  );

  if (!failed) {
    return false;
  }

  await failDetachedK8sMigrationRun(
    run.id,
    'MIGRATION_RUNNER_JOB_FAILED',
    `Migration job ${jobName} ended with status failed`
  );
  return true;
}

async function markRunFailed(
  runId: string,
  errorCode: string,
  errorMessage: string
): Promise<never> {
  const startedAt = await getRunStartedAt(runId);
  const finishedAt = new Date();
  await db
    .update(migrationRuns)
    .set({
      status: 'failed',
      errorCode,
      errorMessage,
      finishedAt,
      durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
      updatedAt: finishedAt,
    })
    .where(eq(migrationRuns.id, runId));
  throw new Error(errorMessage);
}

async function markRunItemFailed(
  itemId: string,
  errorMessage: string,
  output: string
): Promise<void> {
  await db
    .update(migrationRunItems)
    .set({
      status: 'failed',
      error: errorMessage,
      output,
      finishedAt: new Date(),
    })
    .where(eq(migrationRunItems.id, itemId));
}

async function markRunAndItemFailed(input: {
  runId: string;
  itemId: string;
  errorCode: string;
  errorMessage: string;
  output: string;
}): Promise<never> {
  await markRunItemFailed(input.itemId, input.errorMessage, input.output);
  return markRunFailed(input.runId, input.errorCode, input.errorMessage);
}

async function ensureMigrationImagePullSecrets(
  namespace: string,
  imageUrl: string
): Promise<string[] | undefined> {
  if (!usesDeployRegistryImage(imageUrl)) {
    return undefined;
  }

  try {
    const secretReady = await ensureDeployRegistryImagePullAccess(namespace);
    return secretReady ? [getDeployRegistryPullSecretName()] : undefined;
  } catch {
    // Keep running even if secret refresh fails. The namespace may already have the secret.
  }

  return undefined;
}

async function getMigrationStartupTimeoutFailure(input: {
  namespace: string;
  jobName: string;
  pod?: V1Pod;
  imageUrl: string;
}): Promise<{
  errorCode: string;
  errorMessage: string;
}> {
  const podIssue = getMigrationPodIssue(input.pod);
  if (podIssue) {
    return {
      errorCode: 'MIGRATION_POD_UNHEALTHY',
      errorMessage: podIssue,
    };
  }

  const podName = input.pod?.metadata?.name ?? null;
  const events = await getEvents(input.namespace).catch(() => [] as CoreV1Event[]);
  const relevantEvent = events
    .filter((event) => {
      const involvedName = event.involvedObject?.name ?? '';
      return involvedName === input.jobName || (podName ? involvedName === podName : false);
    })
    .sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left))
    .map((event) => describeMigrationEventIssue(event))
    .find((issue): issue is NonNullable<typeof issue> => issue !== null);

  if (relevantEvent) {
    return relevantEvent;
  }

  return {
    errorCode: 'MIGRATION_STARTUP_TIMEOUT',
    errorMessage: `Migration job startup timed out while preparing ${input.imageUrl} (phase=${getMigrationPodPhase(input.pod)})`,
  };
}

async function runSqlMigration(
  runId: string,
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions
): Promise<void> {
  const path =
    resolveMigrationPath(spec.specification, spec.database.type) ??
    `migrations/${spec.database.type}`;
  const files = await fetchMigrationFilesFromRepoPath(
    spec.specification.projectId,
    path,
    options.sourceCommitSha || options.sourceRef || spec.environment.branch || 'main'
  );

  const [item] = await db
    .insert(migrationRunItems)
    .values({
      migrationRunId: runId,
      name: path,
      status: 'running',
    })
    .returning();

  const logs: string[] = [];

  try {
    await executeMigrationsForDatabase(spec.database, files, async (message) => {
      logs.push(message);
      await appendRunLog(runId, message);
    });

    const finishedAt = new Date();
    const startedAt = await getRunStartedAt(runId);
    await db
      .update(migrationRunItems)
      .set({
        status: 'success',
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await db
      .update(migrationRuns)
      .set({
        status: 'success',
        appliedCount: files.length,
        finishedAt,
        durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));
  } catch (error) {
    const finishedAt = new Date();
    await db
      .update(migrationRunItems)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await markRunFailed(
      runId,
      'MIGRATION_COMMAND_FAILED',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runCommandMigration(
  runId: string,
  spec: ResolvedMigrationSpec,
  imageUrl: string
): Promise<void> {
  const namespace = spec.environment.namespace;
  if (!getIsConnected() || !namespace) {
    await markRunFailed(
      runId,
      'MIGRATION_JOB_CREATE_FAILED',
      'Kubernetes is not connected or environment namespace is missing'
    );
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type) ?? '';
  const checksum = crypto
    .createHash('sha256')
    .update(`${spec.specification.command}:${spec.specification.workingDirectory}:${migrationPath}`)
    .digest('hex');

  const jobName = `migration-${runId.slice(0, 8)}`;
  const command = [
    '/bin/sh',
    '-lc',
    `cd ${shellQuote(spec.specification.workingDirectory)} && ${spec.specification.command}`,
  ];
  const imagePullSecrets = await ensureMigrationImagePullSecrets(namespace!, imageUrl);

  const item = await ensureCommandMigrationItem(runId, spec.specification.command, checksum);

  const job: V1Job = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      namespace: namespace ?? undefined,
      labels: {
        'app.kubernetes.io/managed-by': 'juanie',
        'juanie.dev/migration-run-id': runId,
      },
    },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 3600,
      template: {
        metadata: {
          labels: {
            'job-name': jobName,
            'juanie.dev/migration-run-id': runId,
          },
        },
        spec: {
          restartPolicy: 'Never',
          ...(imagePullSecrets
            ? {
                imagePullSecrets: imagePullSecrets.map((secretName) => ({ name: secretName })),
              }
            : {}),
          containers: [
            {
              name: 'migration',
              image: imageUrl,
              command,
              env: buildDatabaseEnvVars(spec),
            },
          ],
        },
      },
    },
  };

  const existingJob = await getExistingJob(namespace!, jobName);
  if (existingJob) {
    await appendRunLog(runId, `检测到已有迁移 Job ${jobName}，恢复监控。`);
  } else {
    try {
      await createJob(namespace!, job);
      await appendRunLog(runId, `已创建迁移 Job ${jobName}。`);
    } catch (error) {
      if (isJobAlreadyExistsError(error)) {
        await appendRunLog(runId, `迁移 Job ${jobName} 已存在，继续接管执行。`);
      } else {
        const failure = classifyMigrationJobCreateError(error);
        await markRunAndItemFailed({
          runId,
          itemId: item.id,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          output: failure.errorMessage,
        });
      }
    }
  }

  let finalLogs = '';
  let executionStartedAt: number | null = null;
  try {
    while (true) {
      const currentJob = await getJob(namespace!, jobName);
      const conditions = currentJob.status?.conditions ?? [];
      const pods = await getPods(namespace!, `job-name=${jobName}`);
      const pod = pods[0];
      const podName = pod?.metadata?.name;

      if (
        conditions.some((condition) => condition.type === 'Complete' && condition.status === 'True')
      ) {
        if (podName) {
          const podLogs = await tryGetPodLogs(namespace!, podName, runId);
          if (podLogs) {
            finalLogs = podLogs;
            await appendRunLog(runId, podLogs);
          }
        }

        const finishedAt = new Date();
        const startedAt = await getRunStartedAt(runId);
        await db
          .update(migrationRunItems)
          .set({
            status: 'success',
            output: finalLogs,
            finishedAt,
          })
          .where(eq(migrationRunItems.id, item.id));
        await db
          .update(migrationRuns)
          .set({
            status: 'success',
            appliedCount: 1,
            finishedAt,
            durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
            updatedAt: finishedAt,
            errorCode: null,
            errorMessage: null,
          })
          .where(eq(migrationRuns.id, runId));
        return;
      }

      const podIssue = getMigrationPodIssue(pod);
      if (podIssue) {
        await markRunAndItemFailed({
          runId,
          itemId: item.id,
          errorCode: 'MIGRATION_POD_UNHEALTHY',
          errorMessage: podIssue,
          output: finalLogs,
        });
      }

      if (isMigrationContainerRunning(pod) && executionStartedAt === null) {
        executionStartedAt = Date.now();
        await appendRunLog(
          runId,
          `迁移容器已启动，进入执行阶段（phase=${getMigrationPodPhase(pod)}）`
        );
      }

      if (podName) {
        const podLogs = await tryGetPodLogs(namespace!, podName, runId);
        if (podLogs) {
          finalLogs = podLogs;
          await appendRunLog(runId, podLogs);
        }
      } else {
        await appendRunLog(runId, '等待迁移 Pod 被调度...');
      }

      if (
        conditions.some((condition) => condition.type === 'Failed' && condition.status === 'True')
      ) {
        await markRunAndItemFailed({
          runId,
          itemId: item.id,
          errorCode: 'MIGRATION_COMMAND_FAILED',
          errorMessage: finalLogs || 'Migration job failed',
          output: finalLogs,
        });
      }

      const now = Date.now();
      const startedAtTime = (await getRunStartedAt(runId))?.getTime() ?? now;
      if (executionStartedAt === null && now - startedAtTime > MIGRATION_STARTUP_TIMEOUT_MS) {
        const timeoutFailure = await getMigrationStartupTimeoutFailure({
          namespace: namespace!,
          jobName,
          pod,
          imageUrl,
        });

        await markRunAndItemFailed({
          runId,
          itemId: item.id,
          errorCode: timeoutFailure.errorCode,
          errorMessage: timeoutFailure.errorMessage,
          output: finalLogs,
        });
      }

      if (
        executionStartedAt !== null &&
        now - executionStartedAt > MIGRATION_EXECUTION_TIMEOUT_MS
      ) {
        await markRunAndItemFailed({
          runId,
          itemId: item.id,
          errorCode: 'MIGRATION_RUN_TIMEOUT',
          errorMessage: 'Migration job execution timed out',
          output: finalLogs,
        });
      }

      await sleep(2000);
    }
  } finally {
    await deleteJob(namespace!, jobName).catch(() => undefined);
  }
}

export async function executeMigrationRun(
  runId: string,
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions = {}
): Promise<void> {
  let activeRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.databaseId, spec.database.id),
      eq(migrationRuns.environmentId, spec.environment.id)
    ),
  });

  for (const run of activeRuns) {
    if (run.id === runId) {
      continue;
    }

    await reconcileDetachedK8sMigrationRun(run, spec.environment.namespace);
  }

  activeRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.databaseId, spec.database.id),
      eq(migrationRuns.environmentId, spec.environment.id)
    ),
  });
  const currentRun = activeRuns.find((run) => run.id === runId) ?? null;

  const conflictingRun = activeRuns.find(
    (run) =>
      run.id !== runId &&
      ACTIVE_MIGRATION_RUN_STATUSES.includes(
        run.status as (typeof ACTIVE_MIGRATION_RUN_STATUSES)[number]
      )
  );
  if (conflictingRun) {
    await markRunFailed(
      runId,
      'MIGRATION_LOCK_CONFLICT',
      `Migration run ${conflictingRun.id} is already active for this database`
    );
  }

  const policyDecision = evaluateMigrationPolicy({
    environment: spec.environment,
    specification: spec.specification,
    allowApprovalBypass: options.allowApprovalBypass,
  });

  if (policyDecision.requiresApproval) {
    await db
      .update(migrationRuns)
      .set({
        status: 'awaiting_approval',
        updatedAt: new Date(),
        errorCode: 'MIGRATION_APPROVAL_REQUIRED',
        errorMessage: policyDecision.approvalReason,
      })
      .where(eq(migrationRuns.id, runId));
    throw new Error(policyDecision.approvalReason ?? '生产环境迁移需要人工审批');
  }

  const startedAt = currentRun?.startedAt ?? new Date();
  const updatedAt = new Date();
  const resumed = currentRun?.status === 'running' && Boolean(currentRun?.startedAt);
  await db
    .update(migrationRuns)
    .set({
      status: 'running',
      startedAt,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      updatedAt,
    })
    .where(eq(migrationRuns.id, runId));

  if (resumed) {
    await appendRunLog(runId, '检测到迁移任务已在运行，恢复监控现有执行。');
  }

  const capabilityCheck = await verifyDeclaredDatabaseCapabilities(spec.database);
  if (!capabilityCheck.satisfied) {
    await markRunFailed(
      runId,
      'MIGRATION_DATABASE_CAPABILITY_UNAVAILABLE',
      formatDatabaseCapabilityIssues(spec.database, capabilityCheck.issues)
    );
  }

  if (spec.specification.tool === 'sql') {
    await ensureManagedPostgresOwnership(spec.database);
    await runSqlMigration(runId, spec, options);
    return;
  }

  if (!options.imageUrl) {
    await markRunFailed(
      runId,
      'MIGRATION_UNSUPPORTED_TOOL',
      `Migration tool ${spec.specification.tool} requires an image URL for runner execution`
    );
  }

  const commandSafety = assessMigrationCommandSafety(spec.specification);
  if (commandSafety.blocksExecution) {
    await markRunFailed(
      runId,
      'MIGRATION_INTERACTIVE_COMMAND_BLOCKED',
      commandSafety.summary ?? '迁移命令可能进入交互式会话，平台已阻止执行'
    );
  }

  await ensureManagedPostgresOwnership(spec.database);
  await runCommandMigration(runId, spec, options.imageUrl!);
}
