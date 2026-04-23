import crypto from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  databaseMigrations,
  databases,
  type EnvironmentSchemaStateStatus,
  environmentSchemaStates,
  migrationSpecifications,
  projects,
} from '@/lib/db/schema';
import {
  diffDatabaseSchemaAgainstDesiredSchema,
  diffDatabaseSchemaAgainstMigrationDir,
  getAppliedAtlasVersions,
  getAtlasDeclaredVersions,
  hasAtlasUserTables,
  isAtlasDatabaseTarget,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';
import { exportDesiredSchemaForSpec } from '@/lib/migrations/desired-schema';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import type {
  MigrationResolutionInfo,
  MigrationSpecificationRecord,
  ResolvedMigrationSpec,
} from '@/lib/migrations/types';
import { publishSchemaRepairRealtimeSnapshot } from '@/lib/realtime/schema-repairs';
import {
  canUseSchemaRunnerJobs,
  runSchemaRunnerJobAndWait,
} from '@/lib/schema-management/schema-runner-job';
import { classifySchemaLedgerState } from './classification';

interface SchemaLedgerInspectionResult {
  kind: 'atlas' | 'drizzle' | 'sql' | 'desired_schema';
  expectedEntries: string[];
  actualEntries: string[];
  hasUserTables: boolean;
}

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
  hasLedger: boolean;
  hasUserTables: boolean;
  summary: string | null;
  lastInspectedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EnvironmentSchemaInspectionInput {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}

interface InspectionDatabaseTarget {
  id: string;
  environmentId: string | null;
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
  if (branch) {
    return branch;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  return project?.repository?.defaultBranch ?? 'main';
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

async function inspectDrizzleDesiredSchema(spec: ResolvedMigrationSpec): Promise<{
  status: 'ok' | 'blocked';
  hasChanges?: boolean;
  driftSummary?: string | null;
  reason?: string;
  snapshot?: SchemaLedgerInspectionResult;
}> {
  if (!isAtlasDatabaseTarget(spec.database)) {
    return {
      status: 'blocked',
      reason: `暂不支持在 ${spec.database.type} 上检查 Drizzle desired schema`,
    };
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const desiredSchema = await exportDesiredSchemaForSpec(spec, ref);

  try {
    const [diff, hasUserTables] = await Promise.all([
      diffDatabaseSchemaAgainstDesiredSchema({
        database: spec.database,
        desiredSchemaUrl: desiredSchema.schemaFileUrl,
      }),
      hasAtlasUserTables(spec.database),
    ]);

    return {
      status: 'ok',
      hasChanges: diff.hasChanges,
      driftSummary: summarizeAtlasSchemaDiffOutput(diff.diffSql),
      snapshot: {
        kind: 'desired_schema',
        expectedEntries: [desiredSchema.revision],
        actualEntries: diff.hasChanges ? [] : [desiredSchema.revision],
        hasUserTables,
      },
    };
  } finally {
    await desiredSchema.cleanup();
  }
}

async function inspectSqlLedger(spec: ResolvedMigrationSpec): Promise<{
  status: 'ok' | 'blocked';
  reason?: string;
  snapshot?: SchemaLedgerInspectionResult;
}> {
  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    return {
      status: 'blocked',
      reason: '无法解析 SQL migration 路径',
    };
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const expectedEntries = (
    await fetchMigrationFilesFromRepoPath(spec.specification.projectId, migrationPath, ref)
  ).map((file) => file.name);

  const actualEntries = (
    await db.query.databaseMigrations.findMany({
      where: and(
        eq(databaseMigrations.databaseId, spec.database.id),
        eq(databaseMigrations.status, 'success')
      ),
      orderBy: [asc(databaseMigrations.filename)],
    })
  ).map((record) => record.filename);

  let hasUserTables = actualEntries.length > 0;

  if (isAtlasDatabaseTarget(spec.database)) {
    try {
      hasUserTables = await hasAtlasUserTables(spec.database);
    } catch (error) {
      return {
        status: 'blocked',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    status: 'ok',
    snapshot: {
      kind: 'sql',
      expectedEntries,
      actualEntries,
      hasUserTables,
    },
  };
}

async function inspectAtlasLedger(spec: ResolvedMigrationSpec): Promise<{
  status: 'ok' | 'blocked';
  reason?: string;
  snapshot?: SchemaLedgerInspectionResult;
}> {
  if (spec.database.type !== 'postgresql' && spec.database.type !== 'mysql') {
    return {
      status: 'blocked',
      reason: `暂不支持在 ${spec.database.type} 上检查 Atlas 账本`,
    };
  }

  if (!isAtlasDatabaseTarget(spec.database)) {
    return {
      status: 'blocked',
      reason: `暂不支持在 ${spec.database.type} 上检查 Atlas 账本`,
    };
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    return {
      status: 'blocked',
      reason: '无法解析 Atlas migration 路径',
    };
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const migrationFiles = (
    await fetchMigrationFilesFromRepoPath(spec.specification.projectId, migrationPath, ref)
  ).filter((file) => file.name.endsWith('.sql'));
  const expectedEntries = getAtlasDeclaredVersions(migrationFiles);

  try {
    const [actualEntries, hasUserTables] = await Promise.all([
      getAppliedAtlasVersions(spec.database),
      hasAtlasUserTables(spec.database),
    ]);

    return {
      status: 'ok',
      snapshot: {
        kind: 'atlas',
        expectedEntries,
        actualEntries,
        hasUserTables,
      },
    };
  } catch (error) {
    return {
      status: 'blocked',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function inspectAtlasSchemaDiff(spec: ResolvedMigrationSpec): Promise<{
  status: 'ok' | 'blocked';
  hasChanges?: boolean;
  driftSummary?: string | null;
  reason?: string;
}> {
  if (!isAtlasDatabaseTarget(spec.database)) {
    return {
      status: 'blocked',
      reason: `暂不支持在 ${spec.database.type} 上通过 Atlas 检查 schema 差异`,
    };
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    return {
      status: 'blocked',
      reason: '无法解析 migration 路径，不能执行 Atlas schema diff',
    };
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);

  try {
    const diff = await diffDatabaseSchemaAgainstMigrationDir({
      database: spec.database,
      projectId: spec.specification.projectId,
      migrationPath,
      revision: ref,
    });

    return {
      status: 'ok',
      hasChanges: diff.hasChanges,
      driftSummary: summarizeAtlasSchemaDiffOutput(diff.diffSql),
    };
  } catch (error) {
    return {
      status: 'blocked',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function upsertEnvironmentSchemaState(input: {
  projectId: string;
  environmentId: string;
  databaseId: string;
  status: EnvironmentSchemaStateStatus;
  expectedEntries: string[];
  actualEntries: string[];
  hasLedger: boolean;
  hasUserTables: boolean;
  summary: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<EnvironmentSchemaStateSnapshot> {
  const now = new Date();
  const [state] = await db
    .insert(environmentSchemaStates)
    .values({
      projectId: input.projectId,
      environmentId: input.environmentId,
      databaseId: input.databaseId,
      status: input.status,
      expectedVersion: input.expectedEntries.at(-1) ?? null,
      actualVersion: input.actualEntries.at(-1) ?? null,
      expectedChecksum: buildChecksum(input.expectedEntries),
      actualChecksum: buildChecksum(input.actualEntries),
      hasLedger: input.hasLedger,
      hasUserTables: input.hasUserTables,
      summary: input.summary,
      lastInspectedAt: now,
      lastErrorCode: input.errorCode ?? null,
      lastErrorMessage: input.errorMessage ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [environmentSchemaStates.databaseId],
      set: {
        status: input.status,
        expectedVersion: input.expectedEntries.at(-1) ?? null,
        actualVersion: input.actualEntries.at(-1) ?? null,
        expectedChecksum: buildChecksum(input.expectedEntries),
        actualChecksum: buildChecksum(input.actualEntries),
        hasLedger: input.hasLedger,
        hasUserTables: input.hasUserTables,
        summary: input.summary,
        lastInspectedAt: now,
        lastErrorCode: input.errorCode ?? null,
        lastErrorMessage: input.errorMessage ?? null,
        updatedAt: now,
      },
    })
    .returning();

  await publishSchemaRepairRealtimeSnapshot({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  return state;
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

  return {
    id: database.id,
    environmentId: database.environmentId,
  };
}

async function buildSchemaInspectionFailureState(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget,
  message: string
): Promise<EnvironmentSchemaStateSnapshot> {
  return upsertEnvironmentSchemaState({
    projectId: input.projectId,
    environmentId: database.environmentId as string,
    databaseId: database.id,
    status: 'blocked',
    expectedEntries: [],
    actualEntries: [],
    hasLedger: false,
    hasUserTables: false,
    summary: `检查失败: ${message}`,
    errorCode: 'SCHEMA_STATE_INSPECTION_FAILED',
    errorMessage: message,
  });
}

function buildSchemaInspectJobName(input: EnvironmentSchemaInspectionInput): string {
  const digest = crypto
    .createHash('sha1')
    .update(
      [
        input.projectId,
        input.databaseId,
        input.sourceRef ?? '',
        input.sourceCommitSha ?? '',
        `${Date.now()}:${Math.random()}`,
      ].join(':')
    )
    .digest('hex')
    .slice(0, 10);

  return `schema-inspect-${input.databaseId.slice(0, 8)}-${digest}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFreshSchemaState(
  input: EnvironmentSchemaInspectionInput,
  startedAt: Date
): Promise<EnvironmentSchemaStateSnapshot | null> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const state = await getEnvironmentSchemaState(input.projectId, input.databaseId);
    if (state?.lastInspectedAt && state.lastInspectedAt.getTime() >= startedAt.getTime() - 1_000) {
      return state;
    }

    await sleep(1_000);
  }

  return await getEnvironmentSchemaState(input.projectId, input.databaseId);
}

async function inspectEnvironmentSchemaStateInRunner(
  input: EnvironmentSchemaInspectionInput
): Promise<EnvironmentSchemaStateSnapshot> {
  const startedAt = new Date();
  const env = [
    {
      name: 'SCHEMA_INSPECT_PROJECT_ID',
      value: input.projectId,
    },
    {
      name: 'SCHEMA_INSPECT_DATABASE_ID',
      value: input.databaseId,
    },
    ...(input.sourceRef
      ? [
          {
            name: 'SCHEMA_INSPECT_SOURCE_REF',
            value: input.sourceRef,
          },
        ]
      : []),
    ...(input.sourceCommitSha
      ? [
          {
            name: 'SCHEMA_INSPECT_SOURCE_COMMIT_SHA',
            value: input.sourceCommitSha,
          },
        ]
      : []),
  ];

  await runSchemaRunnerJobAndWait({
    jobName: buildSchemaInspectJobName(input),
    mode: 'inspect',
    labels: {
      'juanie.dev/schema-inspect': 'true',
      'juanie.dev/database-id': input.databaseId,
    },
    env,
  });

  const state = await waitForFreshSchemaState(input, startedAt);
  if (
    !state ||
    !state.lastInspectedAt ||
    state.lastInspectedAt.getTime() < startedAt.getTime() - 1_000
  ) {
    throw new Error('Schema runner 未写入最新 schema 检查结果');
  }

  return state;
}

async function inspectEnvironmentSchemaStateLocallyInternal(
  input: EnvironmentSchemaInspectionInput,
  database: InspectionDatabaseTarget
): Promise<EnvironmentSchemaStateSnapshot> {
  const resolvedSpec = await resolveSchemaInspectionSpec(input.projectId, input.databaseId, {
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });

  if (!resolvedSpec) {
    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId as string,
      databaseId: database.id,
      status: 'unmanaged',
      expectedEntries: [],
      actualEntries: [],
      hasLedger: false,
      hasUserTables: false,
      summary: '仓库中没有匹配当前数据库的迁移配置',
      errorCode: null,
      errorMessage: null,
    });
  }

  try {
    if (resolvedSpec.specification.tool === 'drizzle') {
      const desiredSchemaInspection = await inspectDrizzleDesiredSchema(resolvedSpec);

      if (desiredSchemaInspection.status === 'blocked' || !desiredSchemaInspection.snapshot) {
        const reason = desiredSchemaInspection.reason ?? 'desired schema 检查失败';
        return upsertEnvironmentSchemaState({
          projectId: input.projectId,
          environmentId: database.environmentId as string,
          databaseId: database.id,
          status: 'blocked',
          expectedEntries: [],
          actualEntries: [],
          hasLedger: false,
          hasUserTables: false,
          summary: reason,
          errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
          errorMessage: reason,
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
        hasLedger: inspected.hasLedger,
        hasUserTables: inspected.hasUserTables,
        summary: inspected.summary,
        errorCode: inspected.status === 'blocked' ? 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED' : null,
        errorMessage: inspected.status === 'blocked' ? inspected.summary : null,
      });
    }

    const ledgerInspection =
      resolvedSpec.specification.tool === 'atlas'
        ? await inspectAtlasLedger(resolvedSpec)
        : resolvedSpec.specification.tool === 'sql'
          ? await inspectSqlLedger(resolvedSpec)
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
        hasLedger: false,
        hasUserTables: false,
        summary: reason,
        errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
        errorMessage: reason,
      });
    }

    const atlasDiff = await inspectAtlasSchemaDiff(resolvedSpec);
    if (atlasDiff.status === 'blocked') {
      const reason = atlasDiff.reason ?? 'Atlas schema diff 失败';
      return upsertEnvironmentSchemaState({
        projectId: input.projectId,
        environmentId: database.environmentId as string,
        databaseId: database.id,
        status: 'blocked',
        expectedEntries: ledgerInspection.snapshot.expectedEntries,
        actualEntries: ledgerInspection.snapshot.actualEntries,
        hasLedger: ledgerInspection.snapshot.actualEntries.length > 0,
        hasUserTables: ledgerInspection.snapshot.hasUserTables,
        summary: reason,
        errorCode: 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED',
        errorMessage: reason,
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
      hasLedger: inspected.hasLedger,
      hasUserTables: inspected.hasUserTables,
      summary: inspected.summary,
      errorCode: inspected.status === 'blocked' ? 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED' : null,
      errorMessage: inspected.status === 'blocked' ? inspected.summary : null,
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
    return await inspectEnvironmentSchemaStateInRunner(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildSchemaInspectionFailureState(input, database, message);
  }
}
