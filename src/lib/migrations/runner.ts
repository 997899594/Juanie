import { and, eq } from 'drizzle-orm';
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
import { type MigrationRunStatus, migrationRunItems, migrationRuns } from '@/lib/db/schema';
import {
  executeAtlasMigrationsForSpec,
  executeDrizzleMigrationsForSpec,
  executeMigrationsForDatabase,
} from '@/lib/migrations/executor';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import {
  inspectResolvedMigrationSpecPendingState,
  normalizeMigrationFilePreviewSnapshot,
  persistMigrationRunFilePreview,
  resolveMigrationPendingState,
} from '@/lib/migrations/file-preview';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview-types';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { isPlatformManagedMigrationSpec } from '@/lib/migrations/platform-managed';
import {
  appendMigrationRunLog,
  getMigrationRunStartedAt,
  isActiveMigrationRunStatus,
  markMigrationRunFailed,
  reconcileStaleActiveMigrationRun,
} from '@/lib/migrations/run-state';
import { evaluateMigrationPolicy } from '@/lib/policies/delivery';
import type { ExecuteMigrationRunOptions, ResolvedMigrationSpec } from './types';

export function getMigrationCompletionStatus(appliedCount: number): MigrationRunStatus {
  return appliedCount > 0 ? 'success' : 'skipped';
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
      await appendMigrationRunLog(runId, message);
    });

    const finishedAt = new Date();
    const startedAt = await getMigrationRunStartedAt(runId);
    await db
      .update(migrationRunItems)
      .set({
        status: getMigrationCompletionStatus(summary.appliedCount),
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await db
      .update(migrationRuns)
      .set({
        status: getMigrationCompletionStatus(summary.appliedCount),
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

    await markMigrationRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
  }
}

async function runDrizzleMigration(
  runId: string,
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions,
  filePreview: MigrationFilePreviewSnapshot | null
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
  const approvedPlanSql =
    filePreview?.executionPlan?.path === 'atlas-schema-diff.sql'
      ? filePreview.executionPlan.content
      : null;

  try {
    const appliedCount = await executeDrizzleMigrationsForSpec(
      spec,
      revision,
      approvedPlanSql,
      async (message) => {
        logs.push(message);
        await appendMigrationRunLog(runId, message);
      }
    );

    const finishedAt = new Date();
    const startedAt = await getMigrationRunStartedAt(runId);
    await db
      .update(migrationRunItems)
      .set({
        status: getMigrationCompletionStatus(appliedCount),
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await db
      .update(migrationRuns)
      .set({
        status: getMigrationCompletionStatus(appliedCount),
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

    await markMigrationRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
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
      await appendMigrationRunLog(runId, message);
    });

    const finishedAt = new Date();
    const startedAt = await getMigrationRunStartedAt(runId);
    await db
      .update(migrationRunItems)
      .set({
        status: getMigrationCompletionStatus(appliedCount),
        output: logs.join('\n'),
        finishedAt,
      })
      .where(eq(migrationRunItems.id, item.id));

    await db
      .update(migrationRuns)
      .set({
        status: getMigrationCompletionStatus(appliedCount),
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

    await markMigrationRunFailed(runId, 'MIGRATION_COMMAND_FAILED', message);
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
  const approvedFilePreview = options.allowApprovalBypass
    ? normalizeMigrationFilePreviewSnapshot(currentRun?.filePreview)
    : null;
  const hasApprovedExecutionPlan =
    spec.specification.tool === 'drizzle' &&
    approvedFilePreview?.executionPlan?.path === 'atlas-schema-diff.sql' &&
    Boolean(approvedFilePreview.executionPlan.content.trim());

  const conflictingRun = activeRuns.find(
    (run) => run.id !== runId && isActiveMigrationRunStatus(run.status)
  );
  if (conflictingRun) {
    await markMigrationRunFailed(
      runId,
      'MIGRATION_LOCK_CONFLICT',
      `Migration run ${conflictingRun.id} is already active for this database`
    );
  }

  const pendingInspection = hasApprovedExecutionPlan
    ? {
        state: resolveMigrationPendingState(approvedFilePreview),
        preview: approvedFilePreview,
      }
    : await inspectResolvedMigrationSpecPendingState(spec, {
        sourceRef: options.sourceRef,
        sourceCommitSha: options.sourceCommitSha,
        forceRefresh: true,
        includeFileDetails: true,
      });

  if (!hasApprovedExecutionPlan && pendingInspection.state !== 'none') {
    await persistMigrationRunFilePreview(runId, pendingInspection.preview);
  }

  if (pendingInspection.state === 'none') {
    const finishedAt = new Date();
    const startedAt = currentRun?.startedAt ?? finishedAt;

    await appendMigrationRunLog(runId, '未检测到待执行的 schema 变更，迁移已跳过。');
    await db
      .update(migrationRuns)
      .set({
        status: 'skipped',
        startedAt,
        finishedAt,
        durationMs: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
        appliedCount: 0,
        errorCode: null,
        errorMessage: null,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));

    return;
  }

  if (pendingInspection.state === 'unknown') {
    await appendMigrationRunLog(
      runId,
      '暂时无法确认是否存在待执行的 schema 变更，系统将按保守策略继续执行或等待审批。'
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
    await appendMigrationRunLog(runId, '检测到迁移任务已在运行，恢复监控现有执行。');
  }

  const runtimeAccessCheck = await verifyDeclaredDatabaseRuntimeAccess(spec.database);
  if (!runtimeAccessCheck.satisfied) {
    await markMigrationRunFailed(
      runId,
      'MIGRATION_DATABASE_RUNTIME_ACCESS_FAILED',
      formatDatabaseRuntimeAccessIssues(spec.database, runtimeAccessCheck.issues)
    );
  }

  const capabilityCheck = await verifyDeclaredDatabaseCapabilities(spec.database);
  if (!capabilityCheck.satisfied) {
    await markMigrationRunFailed(
      runId,
      'MIGRATION_DATABASE_CAPABILITY_UNAVAILABLE',
      formatDatabaseCapabilityIssues(spec.database, capabilityCheck.issues)
    );
  }

  if (spec.specification.executionMode === 'external') {
    await markMigrationRunFailed(
      runId,
      'MIGRATION_EXTERNAL_EXECUTION_REQUIRED',
      `Migration source ${spec.specification.source} is configured for external execution and cannot be run by the platform worker`
    );
  }

  if (!isPlatformManagedMigrationSpec(spec)) {
    await markMigrationRunFailed(
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
    await runDrizzleMigration(runId, spec, options, pendingInspection.preview);
    return;
  }

  if (spec.specification.tool === 'atlas') {
    await runAtlasMigration(runId, spec, options);
    return;
  }

  await markMigrationRunFailed(
    runId,
    'MIGRATION_UNSUPPORTED_TOOL',
    `Migration tool ${spec.specification.tool} is not supported by the platform worker`
  );
}
