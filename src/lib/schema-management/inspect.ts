import crypto from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import postgres from 'postgres';
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
  fetchMigrationFilesFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import type {
  MigrationResolutionInfo,
  MigrationSpecificationRecord,
  ResolvedMigrationSpec,
} from '@/lib/migrations/types';
import { classifySchemaLedgerState } from './classification';

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

interface DrizzleMigrationFileRecord {
  name: string;
  content: string;
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

export function normalizeDrizzleLedgerEntries(input: {
  repoFiles: DrizzleMigrationFileRecord[];
  actualLedgerEntries: string[];
}): string[] {
  const tagByRawLedgerValue = new Map<string, string>();

  for (const file of input.repoFiles) {
    const fileTag = file.name.replace(/\.(sql|js)$/u, '');
    const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');

    tagByRawLedgerValue.set(fileTag, fileTag);
    tagByRawLedgerValue.set(fileHash, fileTag);
  }

  return input.actualLedgerEntries.map((entry) => tagByRawLedgerValue.get(entry) ?? entry);
}

function buildPostgresConnectionString(database: {
  connectionString: string | null;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  username: string | null;
  password: string | null;
}): string | null {
  if (database.connectionString) {
    return database.connectionString;
  }

  if (!database.host || !database.databaseName || !database.username) {
    return null;
  }

  const username = encodeURIComponent(database.username);
  const password = encodeURIComponent(database.password ?? '');
  const auth = database.password ? `${username}:${password}` : username;
  const port = database.port ? `:${database.port}` : '';

  return `postgresql://${auth}@${database.host}${port}/${database.databaseName}`;
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

async function inspectDrizzleLedger(spec: ResolvedMigrationSpec): Promise<{
  status: EnvironmentSchemaStateStatus;
  summary: string;
  expectedEntries: string[];
  actualEntries: string[];
  hasLedger: boolean;
  hasUserTables: boolean;
}> {
  if (spec.database.type !== 'postgresql') {
    return {
      status: 'blocked',
      summary: `暂不支持在 ${spec.database.type} 上检查 Drizzle 账本`,
      expectedEntries: [],
      actualEntries: [],
      hasLedger: false,
      hasUserTables: false,
    };
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    return {
      status: 'blocked',
      summary: '无法解析 Drizzle migration 路径',
      expectedEntries: [],
      actualEntries: [],
      hasLedger: false,
      hasUserTables: false,
    };
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const journalContent = await readRepositoryFileFromRepoPath(
    spec.specification.projectId,
    `${migrationPath}/meta/_journal.json`,
    ref
  );

  const journalEntries = journalContent
    ? (((JSON.parse(journalContent) as { entries?: Array<{ tag?: unknown }> }).entries ?? [])
        .map((entry) => (typeof entry?.tag === 'string' ? entry.tag : ''))
        .filter(Boolean) as string[])
    : [];
  const migrationFiles = await fetchMigrationFilesFromRepoPath(
    spec.specification.projectId,
    migrationPath,
    ref
  );
  const expectedEntries = journalEntries;

  const connectionString = buildPostgresConnectionString(spec.database);
  if (!connectionString) {
    return {
      status: 'blocked',
      summary: '数据库缺少可用的 PostgreSQL 连接信息',
      expectedEntries,
      actualEntries: [],
      hasLedger: false,
      hasUserTables: false,
    };
  }

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  try {
    const [ledgerTableRows, userTableRows] = await Promise.all([
      sql<{ present: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'drizzle'
            AND table_name = '__drizzle_migrations'
        ) AS "present"
      `,
      sql<{ count: number }[]>`
        SELECT count(*)::int AS "count"
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `,
    ]);

    const hasUserTables = Number(userTableRows[0]?.count ?? 0) > 0;
    const ledgerTablePresent = ledgerTableRows[0]?.present === true;
    const actualEntries = ledgerTablePresent
      ? normalizeDrizzleLedgerEntries({
          repoFiles: migrationFiles,
          actualLedgerEntries: (
            await sql<{ hash: string }[]>`
              SELECT hash
              FROM "drizzle"."__drizzle_migrations"
              ORDER BY created_at ASC, id ASC
            `
          ).map((row) => row.hash),
        })
      : [];

    const classified = classifySchemaLedgerState({
      kind: 'drizzle',
      expectedEntries,
      actualEntries,
      hasUserTables,
    });

    return {
      status: classified.status,
      summary: classified.summary,
      expectedEntries,
      actualEntries,
      hasLedger: classified.hasLedger,
      hasUserTables: classified.hasUserTables,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function inspectSqlLedger(spec: ResolvedMigrationSpec): Promise<{
  status: EnvironmentSchemaStateStatus;
  summary: string;
  expectedEntries: string[];
  actualEntries: string[];
  hasLedger: boolean;
  hasUserTables: boolean;
}> {
  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    return {
      status: 'blocked',
      summary: '无法解析 SQL migration 路径',
      expectedEntries: [],
      actualEntries: [],
      hasLedger: false,
      hasUserTables: false,
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

  const classified = classifySchemaLedgerState({
    kind: 'sql',
    expectedEntries,
    actualEntries,
    hasUserTables: actualEntries.length > 0,
  });

  return {
    status: classified.status,
    summary: classified.summary,
    expectedEntries,
    actualEntries,
    hasLedger: classified.hasLedger,
    hasUserTables: classified.hasUserTables,
  };
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

export async function inspectEnvironmentSchemaState(input: {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<EnvironmentSchemaStateSnapshot> {
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

  const resolvedSpec = await resolveSchemaInspectionSpec(input.projectId, input.databaseId, {
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });

  if (!resolvedSpec) {
    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId,
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
    const inspected =
      resolvedSpec.specification.tool === 'drizzle'
        ? await inspectDrizzleLedger(resolvedSpec)
        : resolvedSpec.specification.tool === 'sql'
          ? await inspectSqlLedger(resolvedSpec)
          : {
              status: 'blocked' as const,
              summary: `暂不支持检查 ${resolvedSpec.specification.tool} 迁移账本`,
              expectedEntries: [],
              actualEntries: [],
              hasLedger: false,
              hasUserTables: false,
            };

    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId,
      databaseId: database.id,
      status: inspected.status,
      expectedEntries: inspected.expectedEntries,
      actualEntries: inspected.actualEntries,
      hasLedger: inspected.hasLedger,
      hasUserTables: inspected.hasUserTables,
      summary: inspected.summary,
      errorCode: inspected.status === 'blocked' ? 'SCHEMA_STATE_UNSUPPORTED_OR_BLOCKED' : null,
      errorMessage: inspected.status === 'blocked' ? inspected.summary : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return upsertEnvironmentSchemaState({
      projectId: input.projectId,
      environmentId: database.environmentId,
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
}
