import crypto from 'node:crypto';
import type { V1EnvVar, V1Job, V1Pod } from '@kubernetes/client-node';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import { createJob, deleteJob, getIsConnected, getJob, getPodLogs, getPods } from '@/lib/k8s';
import { executeMigrationsForDatabase } from '@/lib/migrations/executor';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { evaluateMigrationPolicy } from '@/lib/policies/delivery';
import { assessMigrationCommandSafety } from './command-safety';
import type { ExecuteMigrationRunOptions, ResolvedMigrationSpec } from './types';

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

  const [item] = await db
    .insert(migrationRunItems)
    .values({
      migrationRunId: runId,
      name: spec.specification.command,
      checksum,
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

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

  await createJob(namespace!, job);

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
        await db
          .update(migrationRunItems)
          .set({
            status: 'failed',
            error: podIssue,
            output: finalLogs,
            finishedAt: new Date(),
          })
          .where(eq(migrationRunItems.id, item.id));
        await markRunFailed(runId, 'MIGRATION_POD_UNHEALTHY', podIssue);
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
        await db
          .update(migrationRunItems)
          .set({
            status: 'failed',
            error: finalLogs || 'Migration job failed',
            output: finalLogs,
            finishedAt: new Date(),
          })
          .where(eq(migrationRunItems.id, item.id));
        await markRunFailed(runId, 'MIGRATION_COMMAND_FAILED', finalLogs || 'Migration job failed');
      }

      const now = Date.now();
      const startedAtTime = (await getRunStartedAt(runId))?.getTime() ?? now;
      if (executionStartedAt === null && now - startedAtTime > MIGRATION_STARTUP_TIMEOUT_MS) {
        await markRunFailed(
          runId,
          'MIGRATION_STARTUP_TIMEOUT',
          `Migration job startup timed out (phase=${getMigrationPodPhase(pod)})`
        );
      }

      if (
        executionStartedAt !== null &&
        now - executionStartedAt > MIGRATION_EXECUTION_TIMEOUT_MS
      ) {
        await markRunFailed(runId, 'MIGRATION_RUN_TIMEOUT', 'Migration job execution timed out');
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
  const activeRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.databaseId, spec.database.id),
      eq(migrationRuns.environmentId, spec.environment.id)
    ),
  });

  const conflictingRun = activeRuns.find(
    (run) => run.id !== runId && ['queued', 'planning', 'running'].includes(run.status)
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

  const startedAt = new Date();
  await db
    .update(migrationRuns)
    .set({
      status: 'running',
      startedAt,
      updatedAt: startedAt,
    })
    .where(eq(migrationRuns.id, runId));

  if (spec.specification.tool === 'sql') {
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

  await runCommandMigration(runId, spec, options.imageUrl!);
}
