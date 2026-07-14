import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { isSchemaManagedDatabaseType } from '@/lib/databases/platform-support';
import { db } from '@/lib/db';
import {
  databases,
  type EnvironmentSchemaStateStatus,
  environmentSchemaStateRevisions,
  environmentSchemaStates,
  migrationSpecifications,
} from '@/lib/db/schema';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import type {
  MigrationResolutionInfo,
  MigrationSpecificationRecord,
  ResolvedMigrationSpec,
} from '@/lib/migrations/types';
import { resolveProjectRepositoryDefaultBranch } from '@/lib/projects/context';
import { publishSchemaRepairRealtimeSnapshot } from '@/lib/realtime/schema-repairs';
import {
  inspectAtlasLedger,
  inspectAtlasSchemaDiff,
  inspectDrizzleDesiredSchema,
  inspectSqlLedger,
} from '@/lib/schema-management/inspect-adapters';
import {
  canUseSchemaRunnerJobs,
  runSchemaRunnerJobAndWait,
  startSchemaRunnerJob,
} from '@/lib/schema-management/schema-runner-job';
import { classifySchemaLedgerState } from './classification';
import { buildSchemaRevisionKey } from './revision';

export interface EnvironmentSchemaStateSnapshot {
  id: string;
  projectId: string;
  environmentId: string;
  databaseId: string;
  status: EnvironmentSchemaStateStatus;
  expectedVersion: string | null;
  actualVersion: string | null;
  expectedChecksum: string | null;
  actualChecksum: string | null;
  sourceRef: string | null;
  sourceCommitSha: string | null;
  hasLedger: boolean;
  hasUserTables: boolean;
  summary: string | null;
  lastInspectedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentSchemaStateRevisionSnapshot extends EnvironmentSchemaStateSnapshot {
  inspectedAt: Date;
}

interface EnvironmentSchemaInspectionInput {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  updateCurrentState?: boolean;
}

export interface EnvironmentSchemaInspectionRequestSnapshot {
  status: 'queued' | 'running' | 'unavailable' | 'failed';
  currentState: EnvironmentSchemaStateRevisionSnapshot | null;
  message: string | null;
}

interface InspectionDatabaseTarget {
  id: string;
  name: string;
  type: string;
  environmentId: string | null;
  environmentBranch: string | null;
}

interface EffectiveSchemaInspectionSource {
  sourceRef: string | null;
  sourceCommitSha: string | null;
  revision: string;
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

function buildChecksum(entries: string[]): string | null {
  if (entries.length === 0) {
    return null;
  }

  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

async function getProjectDefaultRef(projectId: string, branch?: string | null): Promise<string> {
  return resolveProjectRepositoryDefaultBranch(projectId, branch);
}

function normalizeInspectionRevision(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

async function resolveEffectiveSchemaInspectionSource(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget
): Promise<EffectiveSchemaInspectionSource> {
  const sourceCommitSha = normalizeInspectionRevision(input.sourceCommitSha);
  const sourceRef =
    normalizeInspectionRevision(input.sourceRef) ??
    (await getProjectDefaultRef(input.projectId, database.environmentBranch));

  return {
    sourceRef,
    sourceCommitSha,
    revision: sourceCommitSha ?? sourceRef,
  };
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

function buildResolvedSpec(
  specification: MigrationSpecificationRecord & {
    service: NonNullable<ResolvedMigrationSpec['service']>;
    environment: NonNullable<ResolvedMigrationSpec['environment']>;
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

async function resolveSchemaInspectionSpec(
  projectId: string,
  databaseId: string,
  options?: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): Promise<ResolvedMigrationSpec | null> {
  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, databaseId), eq(databases.projectId, projectId)),
  });

  if (!database?.environmentId) {
    return null;
  }

  const syncedSpecs = await syncMigrationSpecificationsFromRepo(projectId, database.environmentId, {
    sourceRef: options?.sourceRef,
    sourceCommitSha: options?.sourceCommitSha,
  });
  const syncedSpec = pickResolvedSpecForDatabase(databaseId, database.environmentId, syncedSpecs);

  if (syncedSpec) {
    return syncedSpec;
  }

  const persistedSpecification = await db.query.migrationSpecifications.findFirst({
    where: and(
      eq(migrationSpecifications.projectId, projectId),
      eq(migrationSpecifications.databaseId, databaseId),
      eq(migrationSpecifications.environmentId, database.environmentId)
    ),
    with: {
      service: true,
      environment: true,
    },
  });

  if (!persistedSpecification) {
    return null;
  }

  return buildResolvedSpec(persistedSpecification, database, syncedSpecs);
}

export async function resolveSchemaManagementSpec(input: {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<ResolvedMigrationSpec | null> {
  return resolveSchemaInspectionSpec(input.projectId, input.databaseId, {
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });
}

async function upsertEnvironmentSchemaState(input: {
  projectId: string;
  environmentId: string;
  databaseId: string;
  status: EnvironmentSchemaStateStatus;
  expectedEntries: string[];
  actualEntries: string[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  hasLedger: boolean;
  hasUserTables: boolean;
  summary: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  updateCurrentState?: boolean;
}): Promise<EnvironmentSchemaStateSnapshot> {
  const now = new Date();
  const sourceRef = input.sourceRef ?? null;
  const sourceCommitSha = input.sourceCommitSha ?? null;
  const sourceKey = buildSchemaRevisionKey({ sourceRef, sourceCommitSha });
  const stateValues = {
    projectId: input.projectId,
    environmentId: input.environmentId,
    databaseId: input.databaseId,
    status: input.status,
    expectedVersion: input.expectedEntries.at(-1) ?? null,
    actualVersion: input.actualEntries.at(-1) ?? null,
    expectedChecksum: buildChecksum(input.expectedEntries),
    actualChecksum: buildChecksum(input.actualEntries),
    sourceRef,
    sourceCommitSha,
    hasLedger: input.hasLedger,
    hasUserTables: input.hasUserTables,
    summary: input.summary,
    lastInspectedAt: now,
    lastErrorCode: input.errorCode ?? null,
    lastErrorMessage: input.errorMessage ?? null,
    updatedAt: now,
  };
  const revisionValues = {
    projectId: stateValues.projectId,
    environmentId: stateValues.environmentId,
    databaseId: stateValues.databaseId,
    sourceKey,
    sourceRef,
    sourceCommitSha,
    status: stateValues.status,
    expectedVersion: stateValues.expectedVersion,
    actualVersion: stateValues.actualVersion,
    expectedChecksum: stateValues.expectedChecksum,
    actualChecksum: stateValues.actualChecksum,
    hasLedger: stateValues.hasLedger,
    hasUserTables: stateValues.hasUserTables,
    summary: stateValues.summary,
    inspectedAt: now,
    lastErrorCode: stateValues.lastErrorCode,
    lastErrorMessage: stateValues.lastErrorMessage,
    updatedAt: now,
  };

  const [state] = await db.transaction(async (tx) => {
    const [revisionState] = await tx
      .insert(environmentSchemaStateRevisions)
      .values(revisionValues)
      .onConflictDoUpdate({
        target: [
          environmentSchemaStateRevisions.databaseId,
          environmentSchemaStateRevisions.sourceKey,
        ],
        set: {
          ...revisionValues,
        },
      })
      .returning();

    if (input.updateCurrentState === false) {
      return [toEnvironmentSchemaStateSnapshot(revisionState)];
    }

    const [currentState] = await tx
      .insert(environmentSchemaStates)
      .values(stateValues)
      .onConflictDoUpdate({
        target: [environmentSchemaStates.databaseId],
        set: {
          ...stateValues,
        },
      })
      .returning();

    return [currentState];
  });

  await publishSchemaRepairRealtimeSnapshot({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  return state;
}

function toEnvironmentSchemaStateSnapshot(
  revision: typeof environmentSchemaStateRevisions.$inferSelect
): EnvironmentSchemaStateRevisionSnapshot {
  return {
    id: revision.id,
    projectId: revision.projectId,
    environmentId: revision.environmentId,
    databaseId: revision.databaseId,
    status: revision.status,
    expectedVersion: revision.expectedVersion,
    actualVersion: revision.actualVersion,
    expectedChecksum: revision.expectedChecksum,
    actualChecksum: revision.actualChecksum,
    sourceRef: revision.sourceRef,
    sourceCommitSha: revision.sourceCommitSha,
    hasLedger: revision.hasLedger,
    hasUserTables: revision.hasUserTables,
    summary: revision.summary,
    lastInspectedAt: revision.inspectedAt,
    inspectedAt: revision.inspectedAt,
    lastErrorCode: revision.lastErrorCode,
    lastErrorMessage: revision.lastErrorMessage,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
  };
}

export async function getEnvironmentSchemaStateRevision(
  projectId: string,
  databaseId: string,
  input: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): Promise<EnvironmentSchemaStateRevisionSnapshot | null> {
  const sourceRef = input.sourceRef ?? null;
  const sourceCommitSha = input.sourceCommitSha ?? null;
  const sourceKey = buildSchemaRevisionKey({ sourceRef, sourceCommitSha });

  const revision = await db.query.environmentSchemaStateRevisions.findFirst({
    where: and(
      eq(environmentSchemaStateRevisions.projectId, projectId),
      eq(environmentSchemaStateRevisions.databaseId, databaseId),
      eq(environmentSchemaStateRevisions.sourceKey, sourceKey)
    ),
  });

  return revision ? toEnvironmentSchemaStateSnapshot(revision) : null;
}

export async function getEnvironmentSchemaState(
  projectId: string,
  databaseId: string
): Promise<EnvironmentSchemaStateSnapshot | null> {
  const state = await db.query.environmentSchemaStates.findFirst({
    where: and(
      eq(environmentSchemaStates.projectId, projectId),
      eq(environmentSchemaStates.databaseId, databaseId)
    ),
  });

  return state ?? null;
}

async function loadInspectionDatabase(
  input: EnvironmentSchemaInspectionInput
): Promise<InspectionDatabaseTarget> {
  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, input.databaseId), eq(databases.projectId, input.projectId)),
    with: {
      environment: true,
    },
  });

  if (!database) {
    throw new Error('Database not found');
  }

  if (!database.environmentId || !database.environment) {
    throw new Error('Database has no environment binding');
  }

  if (!isSchemaManagedDatabaseType(database.type)) {
    throw new Error(`${database.type} 不参与 schema 管理`);
  }

  return {
    id: database.id,
    name: database.name,
    type: database.type,
    environmentId: database.environmentId,
    environmentBranch: database.environment.branch,
  };
}

async function buildSchemaInspectionFailureState(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget,
  message: string
): Promise<EnvironmentSchemaStateSnapshot> {
  const source = await resolveEffectiveSchemaInspectionSource(input, database);

  return upsertEnvironmentSchemaState({
    projectId: input.projectId,
    environmentId: database.environmentId as string,
    databaseId: database.id,
    status: 'blocked',
    expectedEntries: [],
    actualEntries: [],
    sourceRef: source.sourceRef,
    sourceCommitSha: source.sourceCommitSha,
    hasLedger: false,
    hasUserTables: false,
    summary: `检查失败: ${message}`,
    errorCode: 'SCHEMA_STATE_INSPECTION_FAILED',
    errorMessage: message,
    updateCurrentState: input.updateCurrentState,
  });
}

function buildSchemaInspectJobName(input: {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): string {
  const digest = crypto
    .createHash('sha1')
    .update(
      [input.projectId, input.databaseId, input.sourceRef ?? '', input.sourceCommitSha ?? ''].join(
        ':'
      )
    )
    .digest('hex')
    .slice(0, 10);

  return `schema-inspect-${input.databaseId.slice(0, 8)}-${digest}`;
}

async function buildSchemaInspectRunnerInput(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget
) {
  const source = await resolveEffectiveSchemaInspectionSource(input, database);

  return {
    jobName: buildSchemaInspectJobName({
      projectId: input.projectId,
      databaseId: input.databaseId,
      sourceRef: source.sourceRef,
      sourceCommitSha: source.sourceCommitSha,
    }),
    mode: 'inspect' as const,
    labels: {
      'juanie.dev/schema-inspect': 'true',
      'juanie.dev/database-id': input.databaseId,
    },
    env: [
      {
        name: 'SCHEMA_INSPECT_PROJECT_ID',
        value: input.projectId,
      },
      {
        name: 'SCHEMA_INSPECT_DATABASE_ID',
        value: input.databaseId,
      },
      ...(source.sourceRef
        ? [
            {
              name: 'SCHEMA_INSPECT_SOURCE_REF',
              value: source.sourceRef,
            },
          ]
        : []),
      ...(source.sourceCommitSha
        ? [
            {
              name: 'SCHEMA_INSPECT_SOURCE_COMMIT_SHA',
              value: source.sourceCommitSha,
            },
          ]
        : []),
      {
        name: 'SCHEMA_INSPECT_UPDATE_CURRENT_STATE',
        value: input.updateCurrentState === false ? 'false' : 'true',
      },
    ],
    waitForRedis: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFreshSchemaState(
  input: EnvironmentSchemaInspectionInput,
  startedAt: Date
): Promise<EnvironmentSchemaStateRevisionSnapshot | null> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const state = await getEnvironmentSchemaStateRevision(input.projectId, input.databaseId, {
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    });
    if (state?.lastInspectedAt && state.lastInspectedAt.getTime() >= startedAt.getTime() - 1_000) {
      return state;
    }

    await sleep(1_000);
  }

  return await getEnvironmentSchemaStateRevision(input.projectId, input.databaseId, {
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });
}

async function inspectEnvironmentSchemaStateInRunner(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget
): Promise<EnvironmentSchemaStateSnapshot> {
  const startedAt = new Date();
  const source = await resolveEffectiveSchemaInspectionSource(input, database);
  const runnerInput = await buildSchemaInspectRunnerInput(input, database);

  await runSchemaRunnerJobAndWait({
    jobName: runnerInput.jobName,
    mode: runnerInput.mode,
    labels: runnerInput.labels,
    env: runnerInput.env,
    waitForRedis: runnerInput.waitForRedis,
  });

  const state = await waitForFreshSchemaState(
    {
      projectId: input.projectId,
      databaseId: input.databaseId,
      sourceRef: source.sourceRef,
      sourceCommitSha: source.sourceCommitSha,
    },
    startedAt
  );
  if (!state?.lastInspectedAt || state.lastInspectedAt.getTime() < startedAt.getTime() - 1_000) {
    throw new Error('Schema runner 未写入最新 schema 检查结果');
  }

  return state;
}

async function inspectEnvironmentSchemaStateLocallyInternal(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget
): Promise<EnvironmentSchemaStateSnapshot> {
  const source = await resolveEffectiveSchemaInspectionSource(input, database);
  const resolvedSpec = await resolveSchemaInspectionSpec(input.projectId, input.databaseId, {
    sourceRef: source.sourceRef,
    sourceCommitSha: source.sourceCommitSha,
  });

  if (!resolvedSpec) {
    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId as string,
      databaseId: database.id,
      status: 'unmanaged',
      expectedEntries: [],
      actualEntries: [],
      sourceRef: source.sourceRef,
      sourceCommitSha: source.sourceCommitSha,
      hasLedger: false,
      hasUserTables: false,
      summary: '仓库中没有匹配当前数据库的迁移配置',
      errorCode: null,
      errorMessage: null,
      updateCurrentState: input.updateCurrentState,
    });
  }

  try {
    const inspectionRevision = source.revision;

    if (resolvedSpec.specification.tool === 'drizzle') {
      const desiredSchemaInspection = await inspectDrizzleDesiredSchema(
        resolvedSpec,
        inspectionRevision
      );

      if (desiredSchemaInspection.status === 'blocked' || !desiredSchemaInspection.snapshot) {
        const reason = desiredSchemaInspection.reason ?? 'desired schema 检查失败';
        return upsertEnvironmentSchemaState({
          projectId: input.projectId,
          environmentId: database.environmentId as string,
          databaseId: database.id,
          status: 'blocked',
          expectedEntries: [],
          actualEntries: [],
          sourceRef: source.sourceRef,
          sourceCommitSha: source.sourceCommitSha,
          hasLedger: false,
          hasUserTables: false,
          summary: reason,
          errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
          errorMessage: reason,
          updateCurrentState: input.updateCurrentState,
        });
      }

      const inspected = classifySchemaLedgerState({
        kind: desiredSchemaInspection.snapshot.kind,
        expectedEntries: desiredSchemaInspection.snapshot.expectedEntries,
        actualEntries: desiredSchemaInspection.snapshot.actualEntries,
        hasUserTables: desiredSchemaInspection.snapshot.hasUserTables,
        driftDetected: desiredSchemaInspection.hasChanges === true,
        driftSummary: desiredSchemaInspection.driftSummary,
      });

      return upsertEnvironmentSchemaState({
        projectId: input.projectId,
        environmentId: database.environmentId as string,
        databaseId: database.id,
        status: inspected.status,
        expectedEntries: desiredSchemaInspection.snapshot.expectedEntries,
        actualEntries: desiredSchemaInspection.snapshot.actualEntries,
        sourceRef: source.sourceRef,
        sourceCommitSha: source.sourceCommitSha,
        hasLedger: inspected.hasLedger,
        hasUserTables: inspected.hasUserTables,
        summary: inspected.summary,
        errorCode: inspected.status === 'blocked' ? 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED' : null,
        errorMessage: inspected.status === 'blocked' ? inspected.summary : null,
        updateCurrentState: input.updateCurrentState,
      });
    }

    const ledgerInspection =
      resolvedSpec.specification.tool === 'atlas'
        ? await inspectAtlasLedger(resolvedSpec, inspectionRevision)
        : resolvedSpec.specification.tool === 'sql'
          ? await inspectSqlLedger(resolvedSpec, inspectionRevision)
          : {
              status: 'blocked' as const,
              reason: `暂不支持检查 ${resolvedSpec.specification.tool} 迁移账本`,
            };

    if (ledgerInspection.status === 'blocked' || !ledgerInspection.snapshot) {
      const reason = ledgerInspection.reason ?? '账本检查失败';
      return upsertEnvironmentSchemaState({
        projectId: input.projectId,
        environmentId: database.environmentId as string,
        databaseId: database.id,
        status: 'blocked',
        expectedEntries: [],
        actualEntries: [],
        sourceRef: source.sourceRef,
        sourceCommitSha: source.sourceCommitSha,
        hasLedger: false,
        hasUserTables: false,
        summary: reason,
        errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
        errorMessage: reason,
        updateCurrentState: input.updateCurrentState,
      });
    }

    const atlasDiff = await inspectAtlasSchemaDiff(resolvedSpec, inspectionRevision);
    if (atlasDiff.status === 'blocked') {
      const reason = atlasDiff.reason ?? 'Atlas schema diff 失败';
      return upsertEnvironmentSchemaState({
        projectId: input.projectId,
        environmentId: database.environmentId as string,
        databaseId: database.id,
        status: 'blocked',
        expectedEntries: ledgerInspection.snapshot.expectedEntries,
        actualEntries: ledgerInspection.snapshot.actualEntries,
        sourceRef: source.sourceRef,
        sourceCommitSha: source.sourceCommitSha,
        hasLedger: ledgerInspection.snapshot.actualEntries.length > 0,
        hasUserTables: ledgerInspection.snapshot.hasUserTables,
        summary: reason,
        errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
        errorMessage: reason,
        updateCurrentState: input.updateCurrentState,
      });
    }

    const inspected = classifySchemaLedgerState({
      kind: ledgerInspection.snapshot.kind,
      expectedEntries: ledgerInspection.snapshot.expectedEntries,
      actualEntries: ledgerInspection.snapshot.actualEntries,
      hasUserTables: ledgerInspection.snapshot.hasUserTables,
      driftDetected: atlasDiff.hasChanges === true,
      driftSummary: atlasDiff.driftSummary,
    });

    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId as string,
      databaseId: database.id,
      status: inspected.status,
      expectedEntries: ledgerInspection.snapshot.expectedEntries,
      actualEntries: ledgerInspection.snapshot.actualEntries,
      sourceRef: source.sourceRef,
      sourceCommitSha: source.sourceCommitSha,
      hasLedger: inspected.hasLedger,
      hasUserTables: inspected.hasUserTables,
      summary: inspected.summary,
      errorCode: inspected.status === 'blocked' ? 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED' : null,
      errorMessage: inspected.status === 'blocked' ? inspected.summary : null,
      updateCurrentState: input.updateCurrentState,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildSchemaInspectionFailureState(input, database, message);
  }
}

export async function inspectEnvironmentSchemaStateLocally(
  input: EnvironmentSchemaInspectionInput
): Promise<EnvironmentSchemaStateSnapshot> {
  const database = await loadInspectionDatabase(input);
  return inspectEnvironmentSchemaStateLocallyInternal(input, database);
}

export async function inspectEnvironmentSchemaState(
  input: EnvironmentSchemaInspectionInput
): Promise<EnvironmentSchemaStateSnapshot> {
  const database = await loadInspectionDatabase(input);

  if (!canUseSchemaRunnerJobs() || process.env.JUANIE_SCHEMA_INSPECT_FORCE_LOCAL === 'true') {
    return inspectEnvironmentSchemaStateLocallyInternal(input, database);
  }

  try {
    return await inspectEnvironmentSchemaStateInRunner(input, database);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildSchemaInspectionFailureState(input, database, message);
  }
}

export async function requestEnvironmentSchemaStateInspection(
  input: EnvironmentSchemaInspectionInput
): Promise<EnvironmentSchemaInspectionRequestSnapshot> {
  const database = await loadInspectionDatabase(input);
  const source = await resolveEffectiveSchemaInspectionSource(input, database);
  const currentState = await getEnvironmentSchemaStateRevision(input.projectId, input.databaseId, {
    sourceRef: source.sourceRef,
    sourceCommitSha: source.sourceCommitSha,
  });

  if (!canUseSchemaRunnerJobs() || process.env.JUANIE_SCHEMA_INSPECT_FORCE_LOCAL === 'true') {
    return {
      status: 'unavailable',
      currentState,
      message: 'Schema runner job execution is not available in this runtime',
    };
  }

  try {
    const runnerInput = await buildSchemaInspectRunnerInput(input, database);
    const started = await startSchemaRunnerJob({
      jobName: runnerInput.jobName,
      mode: runnerInput.mode,
      labels: runnerInput.labels,
      env: runnerInput.env,
      waitForRedis: runnerInput.waitForRedis,
    });

    return {
      status: started.status,
      currentState,
      message: started.message,
    };
  } catch (error) {
    return {
      status: 'failed',
      currentState,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
