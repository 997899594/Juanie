import crypto from 'node:crypto';
import type { V1EnvVar, V1Job } from '@kubernetes/client-node';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import { createJob, deleteJob, getIsConnected, getJob, getPodLogs, getPods } from '@/lib/k8s';
import { executeMigrationsForDatabase } from '@/lib/migrations/executor';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import type { ExecuteMigrationRunOptions, ResolvedMigrationSpec } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

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
  const path = spec.specification.migrationPath ?? `migrations/${spec.database.type}`;
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

  const checksum = crypto
    .createHash('sha256')
    .update(
      `${spec.specification.command}:${spec.specification.workingDirectory}:${spec.specification.migrationPath ?? ''}`
    )
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
  try {
    for (let attempts = 0; attempts < 120; attempts++) {
      const currentJob = await getJob(namespace!, jobName);
      const conditions = currentJob.status?.conditions ?? [];
      const pods = await getPods(namespace!, `job-name=${jobName}`);
      const podName = pods[0]?.metadata?.name;
      if (podName) {
        finalLogs = await getPodLogs(namespace!, podName, undefined, 200);
        if (finalLogs) {
          await appendRunLog(runId, finalLogs);
        }
      }

      if (
        conditions.some((condition) => condition.type === 'Complete' && condition.status === 'True')
      ) {
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
          })
          .where(eq(migrationRuns.id, runId));
        return;
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

      await sleep(2000);
    }

    await markRunFailed(runId, 'MIGRATION_RUN_TIMEOUT', 'Migration job timed out');
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

  if (
    spec.specification.approvalPolicy === 'manual_in_production' &&
    spec.environment.isProduction &&
    !options.allowApprovalBypass
  ) {
    await db
      .update(migrationRuns)
      .set({
        status: 'awaiting_approval',
        updatedAt: new Date(),
        errorCode: 'MIGRATION_APPROVAL_REQUIRED',
        errorMessage: 'Manual approval required for production migration',
      })
      .where(eq(migrationRuns.id, runId));
    throw new Error('Manual approval required for production migration');
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

  await runCommandMigration(runId, spec, options.imageUrl!);
}
