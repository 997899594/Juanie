import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  formatDatabaseCapabilityIssues,
  verifyDeclaredDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import {
  formatDatabaseRuntimeAccessIssues,
  verifyDeclaredDatabaseRuntimeAccess,
} from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import { type MigrationRunStatus, migrationRuns } from '@/lib/db/schema';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview';
import {
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
} from '@/lib/policies/delivery';
import { getEnvironmentSchemaStateRevision } from '@/lib/schema-management/inspect';
import { isSchemaStateForRequestedRevision } from '@/lib/schema-management/revision';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';
import { fetchMigrationFilesFromRepoPath } from './fetch';
import { resolveMigrationPath } from './path';
import { resolveMigrationSpecifications } from './resolver';
import { createMigrationSpecificationSnapshot } from './specification-snapshot';
import type { MigrationExecutionPlan, ResolvedMigrationSpec } from './types';

export { resolveMigrationSpecifications } from './resolver';

export type ReleaseMigrationCreationDecision =
  | {
      kind: 'create';
    }
  | {
      kind: 'skip';
    }
  | {
      kind: 'missing_current_schema_state';
    };

export function resolveReleaseMigrationCreationDecision(
  state:
    | {
        status: string;
        sourceRef?: string | null;
        sourceCommitSha?: string | null;
      }
    | null
    | undefined,
  requested: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): ReleaseMigrationCreationDecision {
  if (!state || !isSchemaStateForRequestedRevision(state, requested)) {
    return { kind: 'missing_current_schema_state' };
  }

  return state.status === 'pending_migrations' ? { kind: 'create' } : { kind: 'skip' };
}

function buildPlanEnvVars(spec: ResolvedMigrationSpec): string[] {
  const envVars: string[] = [];

  if (spec.database.connectionString) envVars.push('DATABASE_URL');
  if (spec.database.host) envVars.push('DB_HOST');
  if (spec.database.port) envVars.push('DB_PORT');
  if (spec.database.databaseName) envVars.push('DB_NAME');
  if (spec.database.username) envVars.push('DB_USER');
  if (spec.database.password) envVars.push('DB_PASSWORD');

  return envVars;
}

export async function createMigrationRun(
  spec: ResolvedMigrationSpec,
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api';
    triggeredByUserId?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    initialStatus?: MigrationRunStatus;
    filePreview?: MigrationFilePreviewSnapshot | null;
  }
) {
  const lockKey = `${spec.database.id}:${spec.environment.id}`;

  const [run] = await db
    .insert(migrationRuns)
    .values({
      projectId: spec.specification.projectId,
      serviceId: spec.service.id,
      environmentId: spec.environment.id,
      databaseId: spec.database.id,
      specificationId: spec.specification.id,
      releaseId: input.releaseId ?? null,
      deploymentId: input.deploymentId ?? null,
      triggeredBy: input.triggeredBy,
      triggeredByUserId: input.triggeredByUserId ?? null,
      sourceCommitSha: input.sourceCommitSha ?? null,
      sourceCommitMessage: input.sourceCommitMessage ?? null,
      releaseStage: spec.specification.releaseStage,
      stageOrder: spec.specification.stageOrder,
      targetVersion: spec.specification.targetVersion,
      baselineVersion: spec.specification.baselineVersion,
      specificationSnapshot: createMigrationSpecificationSnapshot(spec.specification),
      status: input.initialStatus ?? 'queued',
      runnerType: spec.specification.executionMode === 'external' ? 'external' : 'schema_runner',
      lockKey,
      filePreview: input.filePreview ?? null,
    })
    .returning();

  return run;
}

export async function resolveAndRunMigrations(
  projectId: string,
  environmentId: string,
  phase: 'preDeploy' | 'postDeploy' | 'manual',
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api';
    triggeredByUserId?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    serviceIds?: string[];
  }
) {
  const runs = await resolveAndCreateMigrationRuns(projectId, environmentId, phase, input);
  return runs;
}

export async function resolveAndCreateMigrationRuns(
  projectId: string,
  environmentId: string,
  phase: 'preDeploy' | 'postDeploy' | 'manual',
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api';
    triggeredByUserId?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    serviceIds?: string[];
  }
) {
  const specs = await resolveMigrationSpecifications(projectId, environmentId, phase, {
    serviceIds: input.serviceIds,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });
  const runs = [];

  for (const spec of specs) {
    if (phase !== 'manual') {
      const schemaState = await getEnvironmentSchemaStateRevision(projectId, spec.database.id, {
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      });
      const decision = resolveReleaseMigrationCreationDecision(schemaState, {
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      });

      if (decision.kind === 'missing_current_schema_state') {
        throw new Error(
          `数据库 ${spec.database.name} 尚未有当前版本的 schema 检查结果，不能执行发布迁移`
        );
      }

      if (decision.kind === 'skip') {
        continue;
      }
    }

    let initialStatus: MigrationRunStatus | undefined;
    if (phase !== 'manual') {
      if (spec.specification.executionMode === 'manual_platform') {
        initialStatus = 'awaiting_approval';
      } else if (spec.specification.executionMode === 'external') {
        initialStatus = 'awaiting_external_completion';
      }
    }

    const run = await createMigrationRun(spec, {
      releaseId: input.releaseId,
      deploymentId: input.deploymentId,
      triggeredBy: input.triggeredBy,
      triggeredByUserId: input.triggeredByUserId,
      sourceCommitSha: input.sourceCommitSha,
      sourceCommitMessage: input.sourceCommitMessage,
      initialStatus,
      filePreview: null,
    });
    runs.push(run);
  }

  const statusRank: Record<MigrationRunStatus, number> = {
    queued: 0,
    awaiting_approval: 1,
    awaiting_external_completion: 2,
    planning: 3,
    running: 4,
    success: 5,
    failed: 6,
    canceled: 7,
    skipped: 8,
  };

  return runs.sort(
    (left, right) =>
      left.stageOrder - right.stageOrder || statusRank[left.status] - statusRank[right.status]
  );
}

export async function getMigrationRunById(runId: string) {
  return db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    with: {
      release: {
        columns: {
          id: true,
          status: true,
        },
      },
      environment: true,
      database: true,
      service: true,
      specification: true,
      items: true,
    },
  });
}

export async function findActiveMigrationRun(input: {
  databaseId: string;
  environmentId: string;
  excludeRunId?: string;
}) {
  return db.query.migrationRuns.findFirst({
    where: and(
      eq(migrationRuns.databaseId, input.databaseId),
      eq(migrationRuns.environmentId, input.environmentId),
      inArray(migrationRuns.status, [
        'queued',
        'planning',
        'running',
        'awaiting_approval',
        'awaiting_external_completion',
      ]),
      input.excludeRunId ? ne(migrationRuns.id, input.excludeRunId) : undefined
    ),
    orderBy: (run, { desc }) => [desc(run.createdAt)],
  });
}

export async function buildMigrationExecutionPlan(
  spec: ResolvedMigrationSpec
): Promise<MigrationExecutionPlan> {
  const confirmationValue = `${spec.database.name}/${spec.environment.name}`;
  const migrationPolicy = evaluateMigrationPolicy({
    environment: spec.environment,
    specification: spec.specification,
  });
  const environmentPolicy = evaluateEnvironmentPolicy(spec.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: spec.environment,
    migrationRuns: [
      {
        specification: spec.specification,
      },
    ],
  });
  const warnings: string[] = [...migrationPolicy.warnings];
  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  const runnerType = spec.specification.executionMode === 'external' ? 'external' : 'schema_runner';
  let canRun = spec.database.status === 'running';
  let blockingReason: string | null =
    spec.database.status === 'running'
      ? null
      : `数据库状态为 ${spec.database.status ?? '未知'}，只有 running 状态才能执行迁移`;
  let filePreviewError: string | null = null;
  let sqlFiles: Array<{ name: string }> = [];
  const runtimeAccessCheck = await verifyDeclaredDatabaseRuntimeAccess(spec.database);

  if (!runtimeAccessCheck.satisfied) {
    canRun = false;
    blockingReason ??= formatDatabaseRuntimeAccessIssues(spec.database, runtimeAccessCheck.issues);
    warnings.push(...runtimeAccessCheck.issues.map((issue) => issue.message));
  }

  if (runtimeAccessCheck.satisfied) {
    const capabilityCheck = await verifyDeclaredDatabaseCapabilities(spec.database);
    if (!capabilityCheck.satisfied) {
      canRun = false;
      blockingReason ??= formatDatabaseCapabilityIssues(spec.database, capabilityCheck.issues);
      warnings.push(...capabilityCheck.issues.map((issue) => issue.message));
    }
  }

  if (spec.specification.tool === 'sql' || spec.specification.tool === 'atlas') {
    try {
      const files = await fetchMigrationFilesFromRepoPath(
        spec.specification.projectId,
        migrationPath ?? `migrations/${spec.database.type}`,
        spec.environment.branch || 'main'
      );
      sqlFiles = files.map((file) => ({ name: file.name }));
      if (sqlFiles.length === 0) {
        warnings.push(`在 ${migrationPath} 下没有找到迁移文件。`);
      }
    } catch (error) {
      canRun = false;
      filePreviewError = error instanceof Error ? error.message : String(error);
      blockingReason ??= `无法从 ${migrationPath} 读取迁移文件：${filePreviewError}`;
    }
  }

  return {
    confirmationValue,
    canRun,
    blockingReason,
    filePreviewError,
    warnings,
    platformSignals: buildPlatformSignalSnapshot({
      environmentPolicySignals: environmentPolicy.signals,
      environmentPolicySignal: environmentPolicy.primarySignal,
      releasePolicySignals: releasePolicy.signals,
      releasePolicySignal: releasePolicy.primarySignal,
      migrationPolicySignals: migrationPolicy.signals,
      migrationPolicySignal: migrationPolicy.primarySignal,
    }),
    environmentPolicy,
    migrationPolicy,
    releasePolicy,
    runnerType,
    database: {
      id: spec.database.id,
      name: spec.database.name,
      type: spec.database.type,
      status: spec.database.status ?? null,
    },
    service: {
      id: spec.service.id,
      name: spec.service.name,
    },
    environment: {
      id: spec.environment.id,
      name: spec.environment.name,
      branch: spec.environment.branch ?? null,
      isProduction: spec.environment.isProduction,
    },
    specification: {
      id: spec.specification.id,
      source: spec.specification.source,
      tool: spec.specification.tool,
      phase: spec.specification.phase,
      releaseStage: spec.specification.releaseStage,
      stageOrder: spec.specification.stageOrder,
      targetVersion: spec.specification.targetVersion,
      baselineVersion: spec.specification.baselineVersion,
      executionMode: spec.specification.executionMode,
      sourceConfigPath: spec.specification.sourceConfigPath ?? null,
      migrationPath,
      command: spec.specification.command,
      compatibility: spec.specification.compatibility,
      approvalPolicy: spec.specification.approvalPolicy,
      lockStrategy: spec.specification.lockStrategy,
    },
    resolution: spec.resolution,
    envVars: buildPlanEnvVars(spec),
    sqlFiles,
  };
}

export async function getMigrationRunsForService(
  projectId: string,
  serviceId: string,
  environmentId?: string
) {
  return db.query.migrationRuns.findMany({
    where: environmentId
      ? and(
          eq(migrationRuns.projectId, projectId),
          eq(migrationRuns.serviceId, serviceId),
          eq(migrationRuns.environmentId, environmentId)
        )
      : and(eq(migrationRuns.projectId, projectId), eq(migrationRuns.serviceId, serviceId)),
    with: {
      environment: true,
      database: true,
      specification: true,
      items: true,
    },
    orderBy: (run, { desc }) => [desc(run.createdAt)],
  });
}
