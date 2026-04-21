import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { BSON, MongoClient, ObjectId } from 'mongodb';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';

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
