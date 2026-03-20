import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Client as PgClient } from 'pg';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';

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
): Promise<void> {
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
    return;
  }

  await log(`🔄 ${database.name}: 发现 ${pending.length} 个待执行迁移`, 'info');

  // 3. 按顺序执行
  for (const file of pending) {
    await executeSingleMigration(database, file, log);
  }
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
