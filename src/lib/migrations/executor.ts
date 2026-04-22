import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { BSON, MongoClient, ObjectId } from 'mongodb';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { AtlasCommandError, runAtlasCommand } from '@/lib/atlas/cli';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';
import {
  applyDesiredSchemaToDatabase,
  getAppliedAtlasVersions,
  getAtlasDeclaredVersions,
  isAtlasDatabaseTarget,
  planApplyDesiredSchema,
  prepareAtlasMigrationWorkspace,
  resolveAtlasDatabaseUrl,
} from '@/lib/migrations/atlas';
import { exportDesiredSchemaForSpec } from '@/lib/migrations/desired-schema';
import { resolveMigrationPath } from '@/lib/migrations/path';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export interface MigrationFile {
  name: string;
  content: string;
}

interface Database {
  id: string;
  type: string;
  connectionString: string | null;
  name: string;
}

export interface MigrationExecutionSummary {
  appliedCount: number;
  skippedCount: number;
}

export async function executeMigrationsForDatabase(
  database: Database,
  migrationFiles: MigrationFile[],
  onLog?: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<MigrationExecutionSummary> {
  const log = onLog || (async () => {});

  // 1. 获取已执行的迁移
  const executed = await db.query.databaseMigrations.findMany({
    where: and(
      eq(databaseMigrations.databaseId, database.id),
      eq(databaseMigrations.status, 'success')
    ),
  });

  const executedNames = new Set(executed.map((m) => m.filename));

  // 2. 找出待执行的迁移
  const pending = migrationFiles
    .filter((f) => !executedNames.has(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (pending.length === 0) {
    await log(`✅ ${database.name}: 无待执行迁移`, 'info');
    return {
      appliedCount: 0,
      skippedCount: migrationFiles.length,
    };
  }

  await log(`🔄 ${database.name}: 发现 ${pending.length} 个待执行迁移`, 'info');

  // 3. 按顺序执行
  let appliedCount = 0;
  let skippedCount = migrationFiles.length - pending.length;

  for (const file of pending) {
    const result = await executeSingleMigration(database, file, log);
    if (result === 'applied') {
      appliedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    appliedCount,
    skippedCount,
  };
}

async function executeSingleMigration(
  database: Database,
  file: MigrationFile,
  log: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<'applied' | 'skipped'> {
  const checksum = crypto.createHash('sha256').update(file.content).digest('hex');

  // 检查是否已存在（防止并发）
  const existing = await db.query.databaseMigrations.findFirst({
    where: and(
      eq(databaseMigrations.databaseId, database.id),
      eq(databaseMigrations.filename, file.name)
    ),
  });

  if (existing) {
    if (existing.status === 'success') {
      await log(`⏭️  ${file.name} 已执行，跳过`, 'info');
      return 'skipped';
    }
    if (existing.checksum !== checksum) {
      throw new Error(`迁移文件 ${file.name} 内容已变更，禁止执行`);
    }
  }

  // 插入记录
  const [migration] = await db
    .insert(databaseMigrations)
    .values({
      databaseId: database.id,
      filename: file.name,
      checksum,
      status: 'running',
    })
    .onConflictDoUpdate({
      target: [databaseMigrations.databaseId, databaseMigrations.filename],
      set: { status: 'running', checksum },
    })
    .returning();

  await log(`▶️  执行迁移: ${file.name}`, 'info');

  try {
    let output = '';

    if (database.type === 'postgresql') {
      output = await executePostgreSQLMigration(database, file.content);
    } else if (database.type === 'mysql') {
      output = await executeMySQLMigration(database, file.content);
    } else if (database.type === 'mongodb') {
      output = await executeMongoDBMigration(database, file.content);
    } else {
      throw new Error(`不支持的数据库类型: ${database.type}`);
    }

    // 标记成功
    await db
      .update(databaseMigrations)
      .set({ status: 'success', output, executedAt: new Date() })
      .where(eq(databaseMigrations.id, migration.id));

    await log(`✅ ${file.name} 执行成功`, 'info');
    return 'applied';
  } catch (err: any) {
    // 标记失败
    await db
      .update(databaseMigrations)
      .set({ status: 'failed', error: err.message })
      .where(eq(databaseMigrations.id, migration.id));

    await log(`❌ ${file.name} 失败: ${err.message}`, 'error');
    throw err;
  }
}

async function executePostgreSQLMigration(database: Database, sql: string): Promise<string> {
  if (!database.connectionString) {
    throw new Error('PostgreSQL connectionString 为空');
  }

  const client = new PgClient({ connectionString: database.connectionString });
  await client.connect();

  try {
    const result = await client.query(sql);
    return `Rows affected: ${result.rowCount ?? 0}`;
  } finally {
    await client.end();
  }
}

function summarizeMySQLRowsAffected(result: unknown): number | null {
  if (!result) {
    return null;
  }

  if (Array.isArray(result)) {
    const total = result.reduce((sum, item) => sum + (summarizeMySQLRowsAffected(item) ?? 0), 0);
    return total > 0 ? total : null;
  }

  if (typeof result === 'object' && 'affectedRows' in result) {
    const affectedRows = result.affectedRows;
    return typeof affectedRows === 'number' ? affectedRows : null;
  }

  return null;
}

export async function executeMySQLMigration(database: Database, sql: string): Promise<string> {
  if (!database.connectionString) {
    throw new Error('MySQL connectionString 为空');
  }

  const connection = await mysql.createConnection({
    uri: database.connectionString,
    multipleStatements: true,
  });

  try {
    const [rows] = await connection.query(sql);
    const affectedRows = summarizeMySQLRowsAffected(rows);
    return affectedRows === null
      ? 'MySQL migration executed successfully'
      : `Rows affected: ${affectedRows}`;
  } finally {
    await connection.end().catch(() => undefined);
  }
}

function normalizeMongoMigrationScript(script: string): string {
  return script
    .replace(/^\s*export\s+default\s+/gm, 'module.exports = ')
    .replace(/^\s*export\s+async\s+function\s+up\s*\(/gm, 'async function up(')
    .replace(/^\s*export\s+function\s+up\s*\(/gm, 'function up(')
    .replace(/^\s*export\s+const\s+up\s*=/gm, 'const up =')
    .replace(/^\s*export\s+\{\s*up(?:\s+as\s+default)?\s*\}\s*;?\s*$/gm, '');
}

function formatMongoMigrationResult(result: unknown): string {
  if (result === undefined) {
    return 'MongoDB migration executed successfully';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (
    typeof result === 'number' ||
    typeof result === 'boolean' ||
    typeof result === 'bigint' ||
    result === null
  ) {
    return `MongoDB migration result: ${String(result)}`;
  }

  try {
    return `MongoDB migration result: ${JSON.stringify(result)}`;
  } catch {
    return 'MongoDB migration executed successfully';
  }
}

export async function executeMongoDBMigration(database: Database, script: string): Promise<string> {
  if (!database.connectionString) {
    throw new Error('MongoDB connectionString 为空');
  }

  const client = new MongoClient(database.connectionString, {
    maxPoolSize: 1,
  });
  await client.connect();

  try {
    const dbHandle = client.db();
    const moduleRef: { exports: unknown } = { exports: {} };
    const exportsRef = moduleRef.exports as Record<string, unknown>;
    const runner = new AsyncFunction(
      'client',
      'db',
      'ObjectId',
      'BSON',
      'module',
      'exports',
      `
${normalizeMongoMigrationScript(script)}

if (typeof module.exports === 'function') {
  return await module.exports({ client, db, ObjectId, BSON });
}

if (module.exports && typeof module.exports === 'object' && typeof module.exports.up === 'function') {
  return await module.exports.up({ client, db, ObjectId, BSON });
}

if (typeof exports.default === 'function') {
  return await exports.default({ client, db, ObjectId, BSON });
}

if (typeof exports.up === 'function') {
  return await exports.up({ client, db, ObjectId, BSON });
}

if (typeof up === 'function') {
  return await up({ client, db, ObjectId, BSON });
}

return undefined;
`
    );

    const result = await runner(client, dbHandle, ObjectId, BSON, moduleRef, exportsRef);
    return formatMongoMigrationResult(result);
  } catch (error) {
    throw new Error(
      `MongoDB migration execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

function buildDesiredSchemaMigrationFilename(
  spec: ResolvedMigrationSpec,
  revision: string
): string {
  const source = spec.specification.source ?? spec.specification.tool;
  const revisionDigest = crypto.createHash('sha1').update(revision).digest('hex').slice(0, 12);
  return `${source}/desired-schema-${revisionDigest}.sql`;
}

async function markDesiredSchemaExecution(input: {
  spec: ResolvedMigrationSpec;
  revision: string;
  schemaSql: string;
  output: string;
}): Promise<void> {
  const filename = buildDesiredSchemaMigrationFilename(input.spec, input.revision);
  const checksum = crypto.createHash('sha256').update(input.schemaSql).digest('hex');

  await db
    .insert(databaseMigrations)
    .values({
      databaseId: input.spec.database.id,
      filename,
      checksum,
      status: 'success',
      output: input.output,
      executedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [databaseMigrations.databaseId, databaseMigrations.filename],
      set: {
        checksum,
        status: 'success',
        output: input.output,
        executedAt: new Date(),
        error: null,
      },
    });
}

export async function executeDrizzleMigrationsForSpec(
  spec: ResolvedMigrationSpec,
  revision: string,
  onLog?: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<number> {
  const log = onLog || (async () => {});

  if (spec.database.type !== 'postgresql') {
    throw new Error(`Drizzle 平台迁移暂不支持 ${spec.database.type}`);
  }

  if (!isAtlasDatabaseTarget(spec.database)) {
    throw new Error(`Drizzle desired schema 发布暂不支持 ${spec.database.type}`);
  }

  const artifact = await exportDesiredSchemaForSpec(spec, revision);
  try {
    await log(
      `🧭 ${spec.database.name}: 使用 ${artifact.sourceConfigPath ?? '自动发现配置'} 导出 desired schema`,
      'info'
    );

    const plan = await planApplyDesiredSchema({
      database: spec.database,
      desiredSchemaUrl: artifact.schemaFileUrl,
    });

    if (!plan.hasChanges) {
      await log(`✅ ${spec.database.name}: 数据库已与 desired schema 对齐`, 'info');
      return 0;
    }

    await log(`🔄 ${spec.database.name}: 检测到 desired schema 变更，准备通过 Atlas 应用`, 'info');

    await applyDesiredSchemaToDatabase({
      database: spec.database,
      desiredSchemaUrl: artifact.schemaFileUrl,
      onOutputLine: (line, stream) => {
        void log(line, stream === 'stderr' ? 'warn' : 'info');
      },
    });

    await markDesiredSchemaExecution({
      spec,
      revision: artifact.revision,
      schemaSql: artifact.schemaSql,
      output:
        plan.planSql ||
        `Applied desired schema from ${artifact.sourceConfigPath ?? 'auto-discovery'}`,
    });

    await log(`✅ ${spec.database.name}: desired schema 已应用`, 'info');
    return 1;
  } finally {
    await artifact.cleanup();
  }
}

async function markAtlasMigrationsApplied(input: {
  databaseId: string;
  files: MigrationFile[];
  appliedVersions: string[];
}): Promise<void> {
  const fileByVersion = new Map(
    input.files
      .map((file) => {
        const [version] = file.name.split('_');
        return version ? [version, file] : null;
      })
      .filter((entry): entry is [string, MigrationFile] => entry !== null)
  );

  for (const version of input.appliedVersions) {
    const file = fileByVersion.get(version);
    if (!file) {
      continue;
    }

    const checksum = crypto.createHash('sha256').update(file.content).digest('hex');

    await db
      .insert(databaseMigrations)
      .values({
        databaseId: input.databaseId,
        filename: file.name,
        checksum,
        status: 'success',
        output: `Applied Atlas migration ${version}`,
        executedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [databaseMigrations.databaseId, databaseMigrations.filename],
        set: {
          checksum,
          status: 'success',
          output: `Applied Atlas migration ${version}`,
          executedAt: new Date(),
          error: null,
        },
      });
  }
}

export async function executeAtlasMigrationsForSpec(
  spec: ResolvedMigrationSpec,
  revision: string,
  onLog?: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<number> {
  const log = onLog || (async () => {});

  if (spec.database.type !== 'postgresql' && spec.database.type !== 'mysql') {
    throw new Error(`Atlas 平台迁移暂不支持 ${spec.database.type}`);
  }

  if (!isAtlasDatabaseTarget(spec.database)) {
    throw new Error(`Atlas 平台迁移暂不支持 ${spec.database.type}`);
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    throw new Error('无法解析 Atlas migration 路径');
  }

  const databaseUrl = resolveAtlasDatabaseUrl(spec.database);
  if (!databaseUrl) {
    throw new Error('数据库缺少可用的连接信息，无法执行 Atlas 迁移');
  }

  const workspace = await prepareAtlasMigrationWorkspace({
    projectId: spec.specification.projectId,
    migrationPath,
    revision,
  });

  try {
    const declaredVersions = getAtlasDeclaredVersions(workspace.files);
    if (declaredVersions.length === 0) {
      await log(`✅ ${spec.database.name}: 无可执行的 Atlas 迁移文件`, 'info');
      return 0;
    }

    const beforeVersions = await getAppliedAtlasVersions(spec.database);
    await log(
      `🔄 ${spec.database.name}: 准备执行 Atlas 迁移 (${declaredVersions.length} 个声明版本)`,
      'info'
    );

    try {
      await runAtlasCommand(
        ['migrate', 'apply', '--dir', 'file://migrations', '--url', databaseUrl],
        {
          cwd: workspace.dir,
          onOutputLine: (line, stream) => {
            void log(line, stream === 'stderr' ? 'warn' : 'info');
          },
        }
      );
    } catch (error) {
      if (error instanceof AtlasCommandError) {
        const details = [error.stdout.trim(), error.stderr.trim()].filter(Boolean).join('\n');
        if (details) {
          await log(details, 'error');
        }
      }

      throw error;
    }

    const afterVersions = await getAppliedAtlasVersions(spec.database);
    const beforeSet = new Set(beforeVersions);
    const appliedVersions = afterVersions.filter((version) => !beforeSet.has(version));

    await markAtlasMigrationsApplied({
      databaseId: spec.database.id,
      files: workspace.files,
      appliedVersions,
    });

    if (appliedVersions.length === 0) {
      await log(`✅ ${spec.database.name}: Atlas 没有待执行迁移`, 'info');
      return 0;
    }

    await log(`✅ ${spec.database.name}: 已执行 ${appliedVersions.length} 个 Atlas 迁移`, 'info');
    return appliedVersions.length;
  } finally {
    await workspace.cleanup();
  }
}
