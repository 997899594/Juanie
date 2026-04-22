import { and, eq, inArray } from 'drizzle-orm';
import {
  formatDatabaseCapabilityIssues,
  verifyDeclaredDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import {
  assertManagedPostgresRuntimeAccess,
  shouldAssertManagedPostgresRuntimeAccess,
} from '@/lib/databases/postgres-ownership';
import {
  formatDatabaseRuntimeAccessIssues,
  verifyDeclaredDatabaseRuntimeAccess,
} from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import {
  executeAtlasMigrationsForSpec,
  executeDrizzleMigrationsForSpec,
  executeMigrationsForDatabase,
} from '@/lib/migrations/executor';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { isPlatformManagedMigrationSpec } from '@/lib/migrations/platform-managed';
import { evaluateMigrationPolicy } from '@/lib/policies/delivery';
import type { ExecuteMigrationRunOptions, ResolvedMigrationSpec } from './types';

type MigrationRunRecord = typeof migrationRuns.$inferSelect;

const MIGRATION_STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVE_MIGRATION_RUN_STATUSES = ['queued', 'planning', 'running'] as const;
const ACTIVE_MIGRATION_ITEM_STATUSES = ['queued', 'planning', 'running'] as const;

async function appendRunLog(
  runId: string,
  message: string,
  options?: {
    touchUpdatedAt?: boolean;
    dedupeConsecutive?: boolean;
  }
): Promise<void> {
  const existing = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
  });
  const currentExcerpt = existing?.logExcerpt ?? '';
  const previousLine = currentExcerpt.trimEnd().split('\n').at(-1) ?? '';

  if (options?.dedupeConsecutive && previousLine === message) {
    return;
  }

  const next = [existing?.logExcerpt ?? '', message].filter(Boolean).join('\n').slice(-8000);
  await db
    .update(migrationRuns)
    .set({
      logExcerpt: next,
      ...(options?.touchUpdatedAt === false ? {} : { updatedAt: new Date() }),
    })
    .where(eq(migrationRuns.id, runId));
}

async function getRunStartedAt(runId: string): Promise<Date | null> {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    columns: { startedAt: true },
  });
  return run?.startedAt ?? null;
}

async function failRunWithoutThrow(
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

async function reconcileStaleActiveMigrationRun(run: MigrationRunRecord): Promise<boolean> {
  if (
    !ACTIVE_MIGRATION_RUN_STATUSES.includes(
      run.status as (typeof ACTIVE_MIGRATION_RUN_STATUSES)[number]
    )
  ) {
    return false;
  }

  const referenceTime = run.updatedAt ?? run.startedAt ?? run.createdAt;
  const staleForMs = Date.now() - referenceTime.getTime();

  if (staleForMs < MIGRATION_STALE_RUN_TIMEOUT_MS) {
    return false;
  }

  const staleMinutes = Math.floor(staleForMs / 60000);
  await failRunWithoutThrow(
    run.id,
    'MIGRATION_RUN_STALE',
    `Migration run became stale after ${staleMinutes} minutes without progress updates`
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
    const summary = await executeMigrationsForDatabase(spec.database, files, async (message) => {
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
        appliedCount: summary.appliedCount,
        finishedAt,
        durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(migrationRunItems)
      .set({
        status: 'failed',
        error: message,
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await markRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
  }
}

async function runDrizzleMigration(
  runId: string,
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions
): Promise<void> {
  const revision =
    options.sourceCommitSha || options.sourceRef || spec.environment.branch || 'main';
  const itemName = spec.specification.sourceConfigPath
    ? `desired-schema:${spec.specification.sourceConfigPath}`
    : 'desired-schema:auto-discovery';

  const [item] = await db
    .insert(migrationRunItems)
    .values({
      migrationRunId: runId,
      name: itemName,
      status: 'running',
    })
    .returning();

  const logs: string[] = [];

  try {
    const appliedCount = await executeDrizzleMigrationsForSpec(spec, revision, async (message) => {
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
        appliedCount,
        finishedAt,
        durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(migrationRunItems)
      .set({
        status: 'failed',
        error: message,
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await markRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
  }
}

async function runAtlasMigration(
  runId: string,
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions
): Promise<void> {
  const path = resolveMigrationPath(spec.specification, spec.database.type) ?? 'migrations';
  const revision =
    options.sourceCommitSha || options.sourceRef || spec.environment.branch || 'main';

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
    const appliedCount = await executeAtlasMigrationsForSpec(spec, revision, async (message) => {
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
        appliedCount,
        finishedAt,
        durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(migrationRunItems)
      .set({
        status: 'failed',
        error: message,
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await markRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
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

    await reconcileStaleActiveMigrationRun(run);
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

  const runtimeAccessCheck = await verifyDeclaredDatabaseRuntimeAccess(spec.database);
  if (!runtimeAccessCheck.satisfied) {
    await markRunFailed(
      runId,
      'MIGRATION_DATABASE_RUNTIME_ACCESS_FAILED',
      formatDatabaseRuntimeAccessIssues(spec.database, runtimeAccessCheck.issues)
    );
  }

  const capabilityCheck = await verifyDeclaredDatabaseCapabilities(spec.database);
  if (!capabilityCheck.satisfied) {
    await markRunFailed(
      runId,
      'MIGRATION_DATABASE_CAPABILITY_UNAVAILABLE',
      formatDatabaseCapabilityIssues(spec.database, capabilityCheck.issues)
    );
  }

  if (spec.specification.executionMode === 'external') {
    await markRunFailed(
      runId,
      'MIGRATION_EXTERNAL_EXECUTION_REQUIRED',
      `Migration source ${spec.specification.source} is configured for external execution and cannot be run by the platform worker`
    );
  }

  if (!isPlatformManagedMigrationSpec(spec)) {
    await markRunFailed(
      runId,
      'MIGRATION_UNSUPPORTED_TOOL',
      `Migration tool ${spec.specification.tool} is not supported by the platform worker`
    );
  }

  if (shouldAssertManagedPostgresRuntimeAccess(spec.database)) {
    await assertManagedPostgresRuntimeAccess(spec.database);
  }

  if (spec.specification.tool === 'sql') {
    await runSqlMigration(runId, spec, options);
    return;
  }

  if (spec.specification.tool === 'drizzle') {
    await runDrizzleMigration(runId, spec, options);
    return;
  }

  if (spec.specification.tool === 'atlas') {
    await runAtlasMigration(runId, spec, options);
    return;
  }

  await markRunFailed(
    runId,
    'MIGRATION_UNSUPPORTED_TOOL',
    `Migration tool ${spec.specification.tool} is not supported by the platform worker`
  );
}
