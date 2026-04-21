import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
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

interface MigrationFile {
  name: string;
  content: string;
}

interface Database {
  id: string;
  type: string;
  connectionString: string | null;
  name: string;
}

export async function executeMigrationsForDatabase(
  database: Database,
  migrationFiles: MigrationFile[],
  onLog?: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<number> {
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
    return 0;
  }

  await log(`🔄 ${database.name}: 发现 ${pending.length} 个待执行迁移`, 'info');

  // 3. 按顺序执行
  for (const file of pending) {
    await executeSingleMigration(database, file, log);
  }

  return pending.length;
}

async function executeSingleMigration(
  database: Database,
  file: MigrationFile,
  log: (message: string, level: 'info' | 'warn' | 'error') => Promise<void>
): Promise<void> {
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
      return;
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

async function executeMySQLMigration(_database: Database, _sql: string): Promise<string> {
  // TODO: 实现 MySQL 支持
  throw new Error('MySQL 迁移暂未实现');
}

async function executeMongoDBMigration(_database: Database, _script: string): Promise<string> {
  // TODO: 实现 MongoDB 支持
  throw new Error('MongoDB 迁移暂未实现');
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
  const files = (await fetchMigrationFilesFromRepoPath(
    spec.specification.projectId,
    migrationPath,
    revision
  )).filter((file) => file.name.endsWith('.sql'));

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
