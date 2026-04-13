import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import type {
  AtlasExecutionStatus,
  EnvironmentSchemaStateStatus,
  SchemaRepairPlanStatus,
} from '@/lib/db/schema';
import { schemaRepairPlans } from '@/lib/db/schema';

export type SchemaRepairPlanKind =
  | 'no_action'
  | 'run_release_migrations'
  | 'mark_aligned'
  | 'repair_pr_required'
  | 'adopt_current_db'
  | 'manual_investigation';

export interface SchemaRepairPlan {
  kind: SchemaRepairPlanKind;
  title: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedVersion: string | null;
  actualVersion: string | null;
  nextActionLabel: string | null;
  steps: string[];
}

export interface PersistedSchemaRepairPlan extends SchemaRepairPlan {
  id: string;
  projectId: string;
  environmentId: string;
  databaseId: string;
  stateStatus: EnvironmentSchemaStateStatus;
  status: SchemaRepairPlanStatus;
  generatedFiles: string[];
  branchName: string | null;
  reviewNumber: number | null;
  reviewUrl: string | null;
  reviewState: 'draft' | 'open' | 'merged' | 'closed' | 'unknown';
  reviewStateLabel: string | null;
  reviewSyncedAt: Date | null;
  atlasExecutionStatus: AtlasExecutionStatus;
  atlasExecutionLog: string | null;
  atlasExecutionStartedAt: Date | null;
  atlasExecutionFinishedAt: Date | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isSchemaRepairResolvedStatus(status: EnvironmentSchemaStateStatus): boolean {
  return status === 'aligned' || status === 'pending_migrations';
}

export function buildSchemaRepairPlan(input: {
  status: EnvironmentSchemaStateStatus;
  summary: string | null;
  expectedVersion: string | null;
  actualVersion: string | null;
}): SchemaRepairPlan {
  switch (input.status) {
    case 'aligned':
      return {
        kind: 'no_action',
        title: '无需修复',
        summary: '当前数据库账本已与仓库迁移链对齐。',
        riskLevel: 'low',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: null,
        steps: ['保持当前状态，后续按正常发布流程推进。'],
      };
    case 'pending_migrations':
      return {
        kind: 'run_release_migrations',
        title: '执行正常发布迁移',
        summary: input.summary ?? '当前数据库只是落后于仓库迁移链，可通过正常发布补齐。',
        riskLevel: 'low',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: '触发正常发布，让前置迁移补齐账本',
        steps: [
          '保持当前迁移文件不变。',
          '按正常发布流程触发 release，让 preDeploy migration 自动推进到期望版本。',
          '发布完成后重新检查 schema 状态。',
        ],
      };
    case 'aligned_untracked':
      return {
        kind: 'mark_aligned',
        title: '标记为已对齐',
        summary: input.summary ?? '当前数据库结构看起来已就绪，但缺少受管迁移账本。',
        riskLevel: 'medium',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: '使用平台的“标记为已对齐”动作补账本',
        steps: [
          '确认当前数据库结构确实已覆盖仓库迁移链要求。',
          '在环境页执行“标记为已对齐”。',
          '平台补写账本后重新检查，确认状态变为已对齐。',
        ],
      };
    case 'drifted':
      return {
        kind: 'repair_pr_required',
        title: '生成 repair migration PR',
        summary: input.summary ?? '当前数据库账本与仓库迁移链不一致，不能靠正常发布直接修复。',
        riskLevel: 'high',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: '先在子应用仓库生成 repair migration，再回到平台重试',
        steps: [
          '先确认当前环境数据库为什么偏离仓库迁移链。',
          '在子应用仓库新增 repair migration 或基线化 PR，不能直接在线手改生产库。',
          'PR 合并后重新执行 schema 检查，再触发发布。',
        ],
      };
    case 'unmanaged':
      return {
        kind: 'adopt_current_db',
        title: '接管当前数据库',
        summary: input.summary ?? '当前数据库还没有进入受管 schema 流程。',
        riskLevel: 'medium',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: '先建立迁移基线或补齐迁移配置',
        steps: [
          '确认仓库中是否已经存在这个数据库的迁移配置。',
          '如果没有，先建立迁移基线并把它提交到仓库。',
          '如果有配置但环境未纳管，先执行检查并走平台接管动作。',
        ],
      };
    case 'blocked':
      return {
        kind: 'manual_investigation',
        title: '先排查再修复',
        summary: input.summary ?? '当前无法安全生成修复动作，需要先排查连接、权限或工具支持。',
        riskLevel: 'high',
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        nextActionLabel: '先修复检查链路，再决定接管或 repair',
        steps: [
          '先解决数据库连接、权限、环境绑定或工具不支持问题。',
          '确保平台可以完成 schema inspect。',
          '检查恢复后，再根据最新状态选择正常发布、标记已对齐或 repair migration。',
        ],
      };
  }
}

export async function createSchemaRepairPlanRecord(input: {
  projectId: string;
  environmentId: string;
  databaseId: string;
  createdByUserId?: string | null;
  stateStatus: EnvironmentSchemaStateStatus;
  summary: string | null;
  expectedVersion: string | null;
  actualVersion: string | null;
}): Promise<PersistedSchemaRepairPlan> {
  const plan = buildSchemaRepairPlan({
    status: input.stateStatus,
    summary: input.summary,
    expectedVersion: input.expectedVersion,
    actualVersion: input.actualVersion,
  });

  await db
    .update(schemaRepairPlans)
    .set({
      status: 'superseded',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schemaRepairPlans.projectId, input.projectId),
        eq(schemaRepairPlans.databaseId, input.databaseId),
        inArray(schemaRepairPlans.status, ['draft', 'review_opened', 'failed'])
      )
    );

  const [record] = await db
    .insert(schemaRepairPlans)
    .values({
      projectId: input.projectId,
      environmentId: input.environmentId,
      databaseId: input.databaseId,
      createdByUserId: input.createdByUserId ?? null,
      stateStatus: input.stateStatus,
      kind: plan.kind,
      title: plan.title,
      summary: plan.summary,
      riskLevel: plan.riskLevel,
      expectedVersion: plan.expectedVersion,
      actualVersion: plan.actualVersion,
      nextActionLabel: plan.nextActionLabel,
      steps: plan.steps,
    })
    .returning();

  return {
    ...record,
    kind: record.kind,
    status: record.status,
    title: record.title,
    summary: record.summary,
    riskLevel: record.riskLevel as SchemaRepairPlan['riskLevel'],
    expectedVersion: record.expectedVersion,
    actualVersion: record.actualVersion,
    nextActionLabel: record.nextActionLabel,
    steps: Array.isArray(record.steps) ? (record.steps as string[]) : [],
    generatedFiles: Array.isArray(record.generatedFiles) ? (record.generatedFiles as string[]) : [],
    branchName: record.branchName,
    reviewNumber: record.reviewNumber,
    reviewUrl: record.reviewUrl,
    reviewState: record.reviewState ?? 'unknown',
    reviewStateLabel: record.reviewStateLabel,
    reviewSyncedAt: record.reviewSyncedAt,
    atlasExecutionStatus: record.atlasExecutionStatus ?? 'idle',
    atlasExecutionLog: record.atlasExecutionLog,
    atlasExecutionStartedAt: record.atlasExecutionStartedAt,
    atlasExecutionFinishedAt: record.atlasExecutionFinishedAt,
    errorMessage: record.errorMessage,
  };
}

export async function markSchemaRepairPlanApplied(input: {
  projectId: string;
  planId: string;
}): Promise<PersistedSchemaRepairPlan> {
  const [record] = await db
    .update(schemaRepairPlans)
    .set({
      status: 'applied',
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schemaRepairPlans.projectId, input.projectId), eq(schemaRepairPlans.id, input.planId))
    )
    .returning();

  if (!record) {
    throw new Error('修复计划不存在');
  }

  await db
    .update(schemaRepairPlans)
    .set({
      status: 'superseded',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schemaRepairPlans.projectId, input.projectId),
        eq(schemaRepairPlans.databaseId, record.databaseId),
        ne(schemaRepairPlans.id, record.id),
        inArray(schemaRepairPlans.status, ['draft', 'review_opened', 'failed'])
      )
    );

  return {
    ...record,
    kind: record.kind,
    status: 'applied',
    title: record.title,
    summary: record.summary,
    riskLevel: record.riskLevel as SchemaRepairPlan['riskLevel'],
    expectedVersion: record.expectedVersion,
    actualVersion: record.actualVersion,
    nextActionLabel: record.nextActionLabel,
    steps: Array.isArray(record.steps) ? (record.steps as string[]) : [],
    generatedFiles: Array.isArray(record.generatedFiles) ? (record.generatedFiles as string[]) : [],
    branchName: record.branchName,
    reviewNumber: record.reviewNumber,
    reviewUrl: record.reviewUrl,
    reviewState: record.reviewState ?? 'unknown',
    reviewStateLabel: record.reviewStateLabel,
    reviewSyncedAt: record.reviewSyncedAt,
    atlasExecutionStatus: record.atlasExecutionStatus ?? 'idle',
    atlasExecutionLog: record.atlasExecutionLog,
    atlasExecutionStartedAt: record.atlasExecutionStartedAt,
    atlasExecutionFinishedAt: record.atlasExecutionFinishedAt,
    errorMessage: null,
  };
}

export async function getLatestSchemaRepairPlansForProject(projectId: string) {
  const rows = await db.query.schemaRepairPlans.findMany({
    where: eq(schemaRepairPlans.projectId, projectId),
    orderBy: [desc(schemaRepairPlans.createdAt)],
  });

  const latestByDatabaseId = new Map<string, PersistedSchemaRepairPlan>();

  for (const row of rows) {
    if (latestByDatabaseId.has(row.databaseId)) {
      continue;
    }

    latestByDatabaseId.set(row.databaseId, {
      ...row,
      kind: row.kind,
      status: row.status,
      title: row.title,
      summary: row.summary,
      riskLevel: row.riskLevel as SchemaRepairPlan['riskLevel'],
      expectedVersion: row.expectedVersion,
      actualVersion: row.actualVersion,
      nextActionLabel: row.nextActionLabel,
      steps: Array.isArray(row.steps) ? (row.steps as string[]) : [],
      generatedFiles: Array.isArray(row.generatedFiles) ? (row.generatedFiles as string[]) : [],
      branchName: row.branchName,
      reviewNumber: row.reviewNumber,
      reviewUrl: row.reviewUrl,
      reviewState: row.reviewState ?? 'unknown',
      reviewStateLabel: row.reviewStateLabel,
      reviewSyncedAt: row.reviewSyncedAt,
      atlasExecutionStatus: row.atlasExecutionStatus ?? 'idle',
      atlasExecutionLog: row.atlasExecutionLog,
      atlasExecutionStartedAt: row.atlasExecutionStartedAt,
      atlasExecutionFinishedAt: row.atlasExecutionFinishedAt,
      errorMessage: row.errorMessage,
    });
  }

  return latestByDatabaseId;
}
