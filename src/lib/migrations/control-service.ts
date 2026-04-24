import { and, eq } from 'drizzle-orm';
import { verifyMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import { getProjectAccessOrThrow } from '@/lib/api/access';
import { db } from '@/lib/db';
import {
  databases,
  migrationRuns,
  migrationSpecifications,
  type ReleaseStatus,
} from '@/lib/db/schema';
import {
  buildMigrationExecutionPlan,
  createMigrationRun,
  findActiveMigrationRun,
  getMigrationRunById,
} from '@/lib/migrations';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import type { MigrationResolutionInfo, ResolvedMigrationSpec } from '@/lib/migrations/types';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { addMigrationJob } from '@/lib/queue';
import {
  persistReleaseRecapSafely,
  resumeReleaseAfterMigrationProgress,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { getReleaseRunningStatusForMigrationPhase } from '@/lib/releases/state-machine';
import {
  RuntimeDatabaseContractSyncBlockedError,
  syncProjectDatabaseRuntimeContractsFromRepo,
} from '@/lib/services/runtime-contract';

export class MigrationControlError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'MigrationControlError';
  }
}

export function isMigrationControlError(error: unknown): error is MigrationControlError {
  return error instanceof MigrationControlError;
}

export interface MigrationRunActionResult {
  message: string;
  runId: string;
}

type PendingRunStatus = 'queued' | 'awaiting_approval' | 'awaiting_external_completion';
export type MigrationRunAction =
  | 'approve'
  | 'retry'
  | 'mark_external_complete'
  | 'mark_external_failed';

export function isMigrationRunAction(action: unknown): action is MigrationRunAction {
  return (
    action === 'approve' ||
    action === 'retry' ||
    action === 'mark_external_complete' ||
    action === 'mark_external_failed'
  );
}

function getExpectedConfirmationValue(databaseName: string, environmentName: string): string {
  return `${databaseName}/${environmentName}`;
}

function getUnknownResolution(): MigrationResolutionInfo {
  return {
    strategy: 'unknown',
    selector: {
      bindingName: null,
      bindingRole: null,
      bindingDatabaseType: null,
    },
  };
}

function buildResolvedSpec(
  specification: ResolvedMigrationSpec['specification'] & {
    service: ResolvedMigrationSpec['service'];
    environment: ResolvedMigrationSpec['environment'];
  },
  database: ResolvedMigrationSpec['database'],
  syncedSpecs: ResolvedMigrationSpec[]
): ResolvedMigrationSpec {
  const synced = syncedSpecs.find((item) => item.specification.id === specification.id);

  return {
    specification,
    database,
    service: specification.service,
    environment: specification.environment,
    resolution: synced?.resolution ?? getUnknownResolution(),
  };
}

function buildResolvedSpecFromRun(
  run: NonNullable<Awaited<ReturnType<typeof getMigrationRunById>>>
) {
  return {
    specification: run.specification,
    database: run.database,
    service: run.service,
    environment: run.environment,
    resolution: getUnknownResolution(),
  } satisfies ResolvedMigrationSpec;
}

function pickResolvedSpecForDatabase(
  databaseId: string,
  environmentId: string,
  syncedSpecs: ResolvedMigrationSpec[]
): ResolvedMigrationSpec | null {
  const candidates = syncedSpecs.filter(
    (item) => item.database.id === databaseId && item.environment.id === environmentId
  );

  if (candidates.length === 0) {
    return null;
  }

  const serviceScoped = candidates.find((item) => item.database.serviceId === item.service.id);
  return serviceScoped ?? candidates[0] ?? null;
}

function requireResolvedSpec(resolvedSpec: ResolvedMigrationSpec | null): ResolvedMigrationSpec {
  if (!resolvedSpec) {
    throw new MigrationControlError(500, '迁移配置解析失败');
  }

  return resolvedSpec;
}

function getInitialStatusForExecutionMode(
  executionMode: ResolvedMigrationSpec['specification']['executionMode']
): PendingRunStatus {
  if (executionMode === 'manual_platform') {
    return 'awaiting_approval';
  }

  if (executionMode === 'external') {
    return 'awaiting_external_completion';
  }

  return 'queued';
}

function getReleaseStatusForPendingRun(
  phase: ResolvedMigrationSpec['specification']['phase'],
  runStatus: PendingRunStatus
): ReleaseStatus | null {
  if (runStatus === 'awaiting_approval') {
    return 'awaiting_approval';
  }

  if (runStatus === 'awaiting_external_completion') {
    return 'awaiting_external_completion';
  }

  return getReleaseRunningStatusForMigrationPhase(phase);
}

function getRunCreatedMessage(status: PendingRunStatus): string {
  if (status === 'awaiting_approval') {
    return '迁移记录已创建，等待审批';
  }

  if (status === 'awaiting_external_completion') {
    return '外部迁移记录已创建，等待标记结果';
  }

  return '迁移已加入队列';
}

function getRetryMessage(status: PendingRunStatus): string {
  if (status === 'awaiting_approval') {
    return '迁移重试已创建，等待审批';
  }

  if (status === 'awaiting_external_completion') {
    return '迁移重试已创建，等待外部完成确认';
  }

  return '迁移重试已加入队列';
}

async function getMigrationDatabaseContext(input: {
  projectId: string;
  databaseId: string;
  userId: string;
  requireManage?: boolean;
  requireResolvedSpec?: boolean;
  syncRuntimeContracts?: boolean;
}) {
  const { project, member } = await getProjectAccessOrThrow(input.projectId, input.userId);

  if (input.syncRuntimeContracts) {
    await syncProjectDatabaseRuntimeContractsFromRepo({
      projectId: input.projectId,
      strict: true,
    });
  }

  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, input.databaseId), eq(databases.projectId, input.projectId)),
    with: {
      environment: true,
    },
  });

  if (!database) {
    throw new MigrationControlError(404, '数据库不存在');
  }

  if (input.requireManage !== false) {
    if (!database.environment) {
      throw new MigrationControlError(400, '数据库缺少环境信息');
    }

    if (!canManageEnvironment(member.role, database.environment)) {
      throw new MigrationControlError(403, getEnvironmentGuardReason(database.environment));
    }
  }

  if (!input.requireResolvedSpec) {
    return {
      project,
      member,
      database,
      resolvedSpec: null,
    };
  }

  if (!database.environmentId) {
    throw new MigrationControlError(400, '数据库缺少环境信息');
  }

  const syncedSpecs = await syncMigrationSpecificationsFromRepo(
    input.projectId,
    database.environmentId
  );
  const syncedSpec = pickResolvedSpecForDatabase(
    input.databaseId,
    database.environmentId,
    syncedSpecs
  );

  const persistedSpecification = syncedSpec
    ? null
    : await db.query.migrationSpecifications.findFirst({
        where: and(
          eq(migrationSpecifications.projectId, input.projectId),
          eq(migrationSpecifications.databaseId, input.databaseId),
          eq(migrationSpecifications.environmentId, database.environmentId)
        ),
        with: {
          service: true,
          environment: true,
        },
      });

  const resolvedSpec = syncedSpec
    ? syncedSpec
    : persistedSpecification
      ? buildResolvedSpec(persistedSpecification, database, syncedSpecs)
      : null;

  if (!resolvedSpec) {
    throw new MigrationControlError(404, '没有找到迁移配置');
  }

  return {
    project,
    member,
    database,
    resolvedSpec,
  };
}

async function getMigrationRunContext(input: {
  projectId: string;
  runId: string;
  userId: string;
  databaseId?: string;
}) {
  const { project, member } = await getProjectAccessOrThrow(input.projectId, input.userId);
  const run = await getMigrationRunById(input.runId);

  if (!run || run.projectId !== input.projectId) {
    throw new MigrationControlError(404, '迁移记录不存在');
  }

  if (input.databaseId && run.databaseId !== input.databaseId) {
    throw new MigrationControlError(404, '迁移记录不存在');
  }

  if (!canManageEnvironment(member.role, run.environment)) {
    throw new MigrationControlError(403, getEnvironmentGuardReason(run.environment));
  }

  return {
    project,
    member,
    run,
  };
}

export async function planMigrationExecutionForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  const { resolvedSpec: unresolvedSpec } = await getMigrationDatabaseContext({
    projectId: input.projectId,
    databaseId: input.databaseId,
    userId: input.userId,
    requireManage: true,
    requireResolvedSpec: true,
    syncRuntimeContracts: true,
  });
  const resolvedSpec = requireResolvedSpec(unresolvedSpec);

  return buildMigrationExecutionPlan(resolvedSpec);
}

export async function createMigrationRunForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
  confirmationText?: string | null;
}) {
  const { database, resolvedSpec: unresolvedSpec } = await getMigrationDatabaseContext({
    projectId: input.projectId,
    databaseId: input.databaseId,
    userId: input.userId,
    requireManage: true,
    requireResolvedSpec: true,
    syncRuntimeContracts: true,
  });
  const resolvedSpec = requireResolvedSpec(unresolvedSpec);

  if (database.status !== 'running') {
    throw new MigrationControlError(400, '数据库当前不可执行迁移');
  }

  const expectedConfirmationValue = getExpectedConfirmationValue(
    database.name,
    resolvedSpec.environment.name
  );

  if (input.confirmationText !== expectedConfirmationValue) {
    throw new MigrationControlError(400, `确认文本不匹配，应输入 ${expectedConfirmationValue}`);
  }

  const activeRun = await findActiveMigrationRun({
    databaseId: resolvedSpec.database.id,
    environmentId: resolvedSpec.environment.id,
  });

  if (activeRun) {
    throw new MigrationControlError(409, `已有迁移正在处理中（${activeRun.status}）`);
  }

  const initialStatus = getInitialStatusForExecutionMode(resolvedSpec.specification.executionMode);
  const run = await createMigrationRun(resolvedSpec, {
    triggeredBy: 'manual',
    triggeredByUserId: input.userId,
    initialStatus,
  });

  if (initialStatus === 'queued') {
    await addMigrationJob(run.id, {
      allowApprovalBypass: false,
    });
  }

  return {
    message: getRunCreatedMessage(initialStatus),
    runId: run.id,
  };
}

export async function listMigrationRunsForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  await getMigrationDatabaseContext({
    projectId: input.projectId,
    databaseId: input.databaseId,
    userId: input.userId,
    requireManage: false,
    requireResolvedSpec: false,
  });

  return db.query.migrationRuns.findMany({
    where: eq(migrationRuns.databaseId, input.databaseId),
    with: {
      environment: true,
      specification: true,
      items: true,
      service: true,
    },
    orderBy: (run, { desc }) => [desc(run.createdAt)],
  });
}

export async function executeMigrationRunActionForActor(input: {
  actorUserId: string;
  projectId: string;
  runId: string;
  action: MigrationRunAction;
  approvalToken?: string | null;
  errorMessage?: string | null;
  databaseId?: string;
}): Promise<MigrationRunActionResult> {
  const { project, run } = await getMigrationRunContext({
    projectId: input.projectId,
    runId: input.runId,
    userId: input.actorUserId,
    databaseId: input.databaseId,
  });

  if (input.action === 'approve') {
    if (typeof input.approvalToken !== 'string' || input.approvalToken.trim().length === 0) {
      throw new MigrationControlError(400, '审批操作缺少 approvalToken');
    }

    if (run.status !== 'awaiting_approval') {
      throw new MigrationControlError(400, '当前迁移不在待审批状态');
    }

    const tokenValid = verifyMigrationApprovalToken({
      token: input.approvalToken,
      teamId: project.teamId,
      projectId: input.projectId,
      environmentId: run.environmentId,
      runId: run.id,
      actorUserId: input.actorUserId,
    });

    if (!tokenValid) {
      throw new MigrationControlError(400, '审批确认无效，请刷新后重试');
    }

    await db
      .update(migrationRuns)
      .set({
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(migrationRuns.id, run.id));

    if (run.releaseId && run.release) {
      const nextReleaseStatus = getReleaseRunningStatusForMigrationPhase(run.specification.phase);

      if (nextReleaseStatus) {
        await updateReleaseStatus(run.releaseId, nextReleaseStatus);
      }
    }

    await addMigrationJob(run.id, {
      allowApprovalBypass: true,
    });

    return {
      message: '迁移审批已通过，已重新加入队列',
      runId: run.id,
    };
  }

  if (input.action === 'mark_external_complete') {
    if (run.status !== 'awaiting_external_completion') {
      throw new MigrationControlError(400, '当前迁移不在待外部完成状态');
    }

    const finishedAt = new Date();
    const startedAt = run.startedAt ?? finishedAt;

    await db
      .update(migrationRuns)
      .set({
        status: 'success',
        errorCode: null,
        errorMessage: null,
        startedAt,
        finishedAt,
        durationMs: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, run.id));

    if (run.releaseId) {
      await resumeReleaseAfterMigrationProgress(run.id);
    }

    return {
      message: '已标记外部迁移完成',
      runId: run.id,
    };
  }

  if (input.action === 'mark_external_failed') {
    if (run.status !== 'awaiting_external_completion') {
      throw new MigrationControlError(400, '当前迁移不在待外部完成状态');
    }

    const failureMessage =
      typeof input.errorMessage === 'string' && input.errorMessage.trim().length > 0
        ? input.errorMessage.trim()
        : '外部迁移被人工标记为失败';

    await db
      .update(migrationRuns)
      .set({
        status: 'failed',
        errorCode: 'external_marked_failed',
        errorMessage: failureMessage,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(migrationRuns.id, run.id));

    if (run.releaseId) {
      const failureStatus: ReleaseStatus =
        run.specification.phase === 'postDeploy' ? 'degraded' : 'migration_pre_failed';
      await updateReleaseStatus(run.releaseId, failureStatus, failureMessage);
      await persistReleaseRecapSafely(run.releaseId);
    }

    return {
      message: '已标记外部迁移失败',
      runId: run.id,
    };
  }

  if (!['failed', 'canceled'].includes(run.status)) {
    throw new MigrationControlError(400, '只有失败或已取消的迁移才能重试');
  }

  const activeRun = await findActiveMigrationRun({
    databaseId: run.databaseId,
    environmentId: run.environmentId,
  });

  if (activeRun) {
    throw new MigrationControlError(409, `已有迁移正在处理中（${activeRun.status}）`);
  }

  const resolvedSpec = buildResolvedSpecFromRun(run);
  const initialStatus = getInitialStatusForExecutionMode(run.specification.executionMode);
  const retryRun = await createMigrationRun(resolvedSpec, {
    releaseId: run.releaseId,
    deploymentId: run.deploymentId,
    triggeredBy: 'manual',
    triggeredByUserId: input.actorUserId,
    sourceCommitSha: run.sourceCommitSha,
    sourceCommitMessage: run.sourceCommitMessage,
    initialStatus,
  });

  if (run.releaseId) {
    const nextReleaseStatus = getReleaseStatusForPendingRun(run.specification.phase, initialStatus);
    if (nextReleaseStatus) {
      await updateReleaseStatus(run.releaseId, nextReleaseStatus);
    }
  }

  if (initialStatus === 'queued') {
    await addMigrationJob(retryRun.id, {
      allowApprovalBypass: false,
    });
  }

  return {
    message: getRetryMessage(initialStatus),
    runId: retryRun.id,
  };
}

export function isRuntimeDatabaseContractSyncBlockedError(
  error: unknown
): error is RuntimeDatabaseContractSyncBlockedError {
  return error instanceof RuntimeDatabaseContractSyncBlockedError;
}
