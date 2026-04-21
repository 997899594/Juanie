import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { BSON, MongoClient, ObjectId } from 'mongodb';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';
import { drizzleTagToFilename, parseDrizzleJournalEntries } from '@/lib/migrations/drizzle';
import {
  fetchMigrationFilesFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';
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

async function ensureDrizzleLedger(client: PgClient): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

async function getExecutedDrizzleTags(
  client: PgClient,
  files: MigrationFile[],
  journalTags: string[]
): Promise<Set<string>> {
  const result = await client.query<{ hash: string }>(
    'SELECT hash FROM "drizzle"."__drizzle_migrations" ORDER BY created_at ASC, id ASC'
  );

  const normalized = new Set<string>();
  const tagByRawLedgerValue = new Map<string, string>();

  for (const tag of journalTags) {
    tagByRawLedgerValue.set(tag, tag);
  }

  for (const file of files) {
    const fileTag = file.name.replace(/\.(sql|js)$/u, '');
    const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');
    tagByRawLedgerValue.set(fileTag, fileTag);
    tagByRawLedgerValue.set(fileHash, fileTag);
  }

  for (const row of result.rows) {
    if (!row.hash) {
      continue;
    }

    normalized.add(tagByRawLedgerValue.get(row.hash) ?? row.hash);
  }

  return normalized;
}

async function executeSingleDrizzleMigration(
  spec: ResolvedMigrationSpec,
  file: MigrationFile,
  journalTag: string,
  createdAt: number,
  log: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<void> {
  const checksum = crypto.createHash('sha256').update(file.content).digest('hex');

  const existing = await db.query.databaseMigrations.findFirst({
    where: and(
      eq(databaseMigrations.databaseId, spec.database.id),
      eq(databaseMigrations.filename, file.name)
    ),
  });

  if (existing?.status === 'success') {
    await log(`⏭️  ${file.name} 已执行，跳过`, 'info');
    return;
  }

  if (existing && existing.checksum !== checksum) {
    throw new Error(`迁移文件 ${file.name} 内容已变更，禁止执行`);
  }

  const [migration] = await db
    .insert(databaseMigrations)
    .values({
      databaseId: spec.database.id,
      filename: file.name,
      checksum,
      status: 'running',
    })
    .onConflictDoUpdate({
      target: [databaseMigrations.databaseId, databaseMigrations.filename],
      set: { status: 'running', checksum },
    })
    .returning();

  await log(`▶️  执行 Drizzle 迁移: ${file.name}`, 'info');

  const client = new PgClient({ connectionString: spec.database.connectionString! });
  await client.connect();

  try {
    await ensureDrizzleLedger(client);
    await client.query(file.content);
    await client.query(
      'INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
      [journalTag, createdAt]
    );

    await db
      .update(databaseMigrations)
      .set({
        status: 'success',
        output: `Applied Drizzle migration ${journalTag}`,
        executedAt: new Date(),
      })
      .where(eq(databaseMigrations.id, migration.id));

    await log(`✅ ${file.name} 执行成功`, 'info');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(databaseMigrations)
      .set({ status: 'failed', error: message })
      .where(eq(databaseMigrations.id, migration.id));

    await log(`❌ ${file.name} 失败: ${message}`, 'error');
    throw error;
  } finally {
    await client.end();
  }
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

  if (!spec.database.connectionString) {
    throw new Error('PostgreSQL connectionString 为空');
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    throw new Error('无法解析 Drizzle migration 路径');
  }

  const journalContent = await readRepositoryFileFromRepoPath(
    spec.specification.projectId,
    `${migrationPath}/meta/_journal.json`,
    revision
  );
  const journalEntries = parseDrizzleJournalEntries(journalContent);
  const files = (
    await fetchMigrationFilesFromRepoPath(spec.specification.projectId, migrationPath, revision)
  ).filter((file) => file.name.endsWith('.sql'));

  const fileByName = new Map(files.map((file) => [file.name, file]));
  const declaredFiles =
    journalEntries.length > 0
      ? journalEntries.map((entry) => ({
          ...entry,
          file: fileByName.get(drizzleTagToFilename(entry.tag)) ?? null,
        }))
      : files.map((file, index) => ({
          idx: index,
          tag: file.name.replace(/\.sql$/u, ''),
          when: Date.now(),
          file,
        }));

  const missingFiles = declaredFiles.filter((entry) => !entry.file).map((entry) => entry.tag);
  if (missingFiles.length > 0) {
    throw new Error(`Drizzle journal 引用了缺失的迁移文件: ${missingFiles.join(', ')}`);
  }

  let pending = declaredFiles;
  const client = new PgClient({ connectionString: spec.database.connectionString });
  await client.connect();

  try {
    await ensureDrizzleLedger(client);
    const executedTags = await getExecutedDrizzleTags(
      client,
      files,
      declaredFiles.map((entry) => entry.tag)
    );

    pending = declaredFiles.filter((entry) => !executedTags.has(entry.tag));

    if (pending.length === 0) {
      await log(`✅ ${spec.database.name}: 无待执行 Drizzle 迁移`, 'info');
      return 0;
    }

    await log(`🔄 ${spec.database.name}: 发现 ${pending.length} 个待执行 Drizzle 迁移`, 'info');
  } finally {
    await client.end();
  }

  for (const entry of pending) {
    if (!entry.file) {
      continue;
    }

    await executeSingleDrizzleMigration(spec, entry.file, entry.tag, entry.when, log);
  }

  return pending.length;
}
