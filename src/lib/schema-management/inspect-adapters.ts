import { and, asc, eq } from 'drizzle-orm';
import {
  ensureDeclaredDatabaseCapabilities,
  formatDatabaseCapabilityIssues,
} from '@/lib/databases/capabilities';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';
import {
  diffDatabaseSchemaAgainstDesiredSchema,
  diffDatabaseSchemaAgainstMigrationDir,
  getAppliedAtlasVersions,
  hasAtlasUserTables,
  isAtlasDatabaseTarget,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';
import { getAtlasDeclaredVersions } from '@/lib/migrations/atlas-versioning';
import { exportDesiredSchemaForSpec } from '@/lib/migrations/desired-schema';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';

export interface SchemaLedgerInspectionResult {
  kind: 'atlas' | 'drizzle' | 'sql' | 'desired_schema';
  expectedEntries: string[];
  actualEntries: string[];
  hasUserTables: boolean;
}

export async function inspectDrizzleDesiredSchema(
  spec: ResolvedMigrationSpec,
  revision: string
): Promise<{
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

  const capabilityCheck = await ensureDeclaredDatabaseCapabilities(spec.database);
  if (!capabilityCheck.satisfied) {
    return {
      status: 'blocked',
      reason: formatDatabaseCapabilityIssues(spec.database, capabilityCheck.issues),
    };
  }

  const desiredSchema = await exportDesiredSchemaForSpec(spec, revision);

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

export async function inspectSqlLedger(
  spec: ResolvedMigrationSpec,
  revision: string
): Promise<{
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

  const expectedEntries = (
    await fetchMigrationFilesFromRepoPath(spec.specification.projectId, migrationPath, revision)
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

export async function inspectAtlasLedger(
  spec: ResolvedMigrationSpec,
  revision: string
): Promise<{
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

  const migrationFiles = (
    await fetchMigrationFilesFromRepoPath(spec.specification.projectId, migrationPath, revision)
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

export async function inspectAtlasSchemaDiff(
  spec: ResolvedMigrationSpec,
  revision: string
): Promise<{
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

  try {
    const diff = await diffDatabaseSchemaAgainstMigrationDir({
      database: spec.database,
      projectId: spec.specification.projectId,
      migrationPath,
      revision,
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
