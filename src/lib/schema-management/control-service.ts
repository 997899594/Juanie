import { and, desc, eq } from 'drizzle-orm';
import { getProjectAccessOrThrow } from '@/lib/api/access';
import { db } from '@/lib/db';
import { databases, schemaRepairPlans } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { markEnvironmentSchemaAligned } from '@/lib/schema-management/adopt';
import {
  type EnvironmentSchemaStateSnapshot,
  getEnvironmentSchemaState,
  inspectEnvironmentSchemaState,
} from '@/lib/schema-management/inspect';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-management/presentation';
import {
  createSchemaRepairPlanRecord,
  discardSchemaRepairPlan,
  isSchemaRepairResolvedStatus,
  markSchemaRepairPlanApplied,
  type PersistedSchemaRepairPlan,
  toPersistedSchemaRepairPlan,
} from '@/lib/schema-management/repair-plan';
import { createSchemaRepairReviewRequest } from '@/lib/schema-management/review-request';
import { runSchemaRepairAtlas } from './atlas-run';

export class SchemaManagementActionError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SchemaManagementActionError';
  }
}

export function isSchemaManagementActionError(
  error: unknown
): error is SchemaManagementActionError {
  return error instanceof SchemaManagementActionError;
}

export interface PresentedEnvironmentSchemaState extends EnvironmentSchemaStateSnapshot {
  statusLabel: string;
}

interface SchemaDatabaseContext {
  database: {
    id: string;
    projectId: string;
    environment: {
      id: string;
      name: string;
      kind: string | null;
      isProduction: boolean | null;
      isPreview: boolean | null;
      deliveryMode: 'direct' | 'promote_only';
    } | null;
  };
}

function presentSchemaState(
  state: EnvironmentSchemaStateSnapshot | null
): PresentedEnvironmentSchemaState | null {
  if (!state) {
    return null;
  }

  return {
    ...state,
    statusLabel: getEnvironmentSchemaStateLabel(state.status),
  };
}

async function getSchemaDatabaseContext(input: {
  projectId: string;
  databaseId: string;
  userId: string;
  requireManage?: boolean;
}): Promise<SchemaDatabaseContext> {
  const { member } = await getProjectAccessOrThrow(input.projectId, input.userId);
  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, input.databaseId), eq(databases.projectId, input.projectId)),
    columns: {
      id: true,
      projectId: true,
    },
    with: {
      environment: {
        columns: {
          id: true,
          name: true,
          kind: true,
          isProduction: true,
          isPreview: true,
          deliveryMode: true,
        },
      },
    },
  });

  if (!database) {
    throw new SchemaManagementActionError(404, '数据库不存在');
  }

  if (input.requireManage !== false) {
    if (!database.environment) {
      throw new SchemaManagementActionError(400, '数据库缺少环境绑定');
    }

    if (!canManageEnvironment(member.role, database.environment)) {
      throw new SchemaManagementActionError(403, getEnvironmentGuardReason(database.environment));
    }
  }

  return { database };
}

async function getLatestSchemaRepairPlanForDatabase(input: {
  projectId: string;
  databaseId: string;
  missingMessage: string;
}): Promise<PersistedSchemaRepairPlan> {
  const latestPlan = await db.query.schemaRepairPlans.findFirst({
    where: and(
      eq(schemaRepairPlans.projectId, input.projectId),
      eq(schemaRepairPlans.databaseId, input.databaseId)
    ),
    orderBy: [desc(schemaRepairPlans.createdAt)],
  });

  if (!latestPlan) {
    throw new SchemaManagementActionError(400, input.missingMessage);
  }

  return toPersistedSchemaRepairPlan(latestPlan);
}

export async function getStoredSchemaStateForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}): Promise<PresentedEnvironmentSchemaState | null> {
  await getSchemaDatabaseContext({
    projectId: input.projectId,
    databaseId: input.databaseId,
    userId: input.userId,
    requireManage: false,
  });

  return presentSchemaState(await getEnvironmentSchemaState(input.projectId, input.databaseId));
}

export async function inspectSchemaStateForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}): Promise<PresentedEnvironmentSchemaState> {
  await getSchemaDatabaseContext(input);
  const state = await inspectEnvironmentSchemaState({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  return presentSchemaState(state) as PresentedEnvironmentSchemaState;
}

export async function createSchemaRepairPlanForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  const { database } = await getSchemaDatabaseContext(input);

  if (!database.environment) {
    throw new SchemaManagementActionError(400, '数据库缺少环境绑定');
  }

  const state = await inspectEnvironmentSchemaState({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });
  const plan = await createSchemaRepairPlanRecord({
    projectId: input.projectId,
    environmentId: database.environment.id,
    databaseId: input.databaseId,
    createdByUserId: input.userId,
    stateStatus: state.status,
    summary: state.summary,
    expectedVersion: state.expectedVersion,
    actualVersion: state.actualVersion,
  });

  return {
    state: presentSchemaState(state),
    plan,
  };
}

export async function markLatestSchemaRepairPlanAppliedForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  await getSchemaDatabaseContext(input);
  const latestPlan = await getLatestSchemaRepairPlanForDatabase({
    projectId: input.projectId,
    databaseId: input.databaseId,
    missingMessage: '没有可标记的修复计划',
  });
  const state = await inspectEnvironmentSchemaState({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  if (!isSchemaRepairResolvedStatus(state.status)) {
    throw new SchemaManagementActionError(
      409,
      `当前 schema 状态仍为 ${state.status}，不能标记修复计划已应用`
    );
  }

  const plan = await markSchemaRepairPlanApplied({
    projectId: input.projectId,
    planId: latestPlan.id,
  });

  return {
    state: presentSchemaState(state),
    plan,
  };
}

export async function discardLatestSchemaRepairPlanForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  await getSchemaDatabaseContext(input);
  const latestPlan = await getLatestSchemaRepairPlanForDatabase({
    projectId: input.projectId,
    databaseId: input.databaseId,
    missingMessage: '没有可丢弃的修复建议',
  });

  return discardSchemaRepairPlan({
    projectId: input.projectId,
    planId: latestPlan.id,
  });
}

export async function createSchemaRepairReviewRequestForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  await getSchemaDatabaseContext(input);
  const latestPlan = await getLatestSchemaRepairPlanForDatabase({
    projectId: input.projectId,
    databaseId: input.databaseId,
    missingMessage: '请先检测并生成修复建议',
  });

  return createSchemaRepairReviewRequest({
    projectId: input.projectId,
    planId: latestPlan.id,
    userId: input.userId,
  });
}

export async function runSchemaRepairAtlasForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}) {
  await getSchemaDatabaseContext(input);
  const latestPlan = await getLatestSchemaRepairPlanForDatabase({
    projectId: input.projectId,
    databaseId: input.databaseId,
    missingMessage: '没有可执行的修复计划',
  });

  return runSchemaRepairAtlas({
    projectId: input.projectId,
    planId: latestPlan.id,
    userId: input.userId,
  });
}

export async function markSchemaAlignedForDatabase(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}): Promise<PresentedEnvironmentSchemaState> {
  await getSchemaDatabaseContext(input);
  const state = await markEnvironmentSchemaAligned(input);

  return presentSchemaState(state) as PresentedEnvironmentSchemaState;
}
