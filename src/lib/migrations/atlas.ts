import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { normalizeAtlasDatabaseUrl, runAtlasCommand } from '@/lib/atlas/cli';
import { buildNormalizedPostgresUrl, normalizeDatabaseUrl } from '@/lib/db/connection-url';
import {
  fetchMigrationFilesFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';

const ATLAS_REVISIONS_TABLE = 'atlas_schema_revisions';

export interface AtlasMigrationFile {
  name: string;
  content: string;
}

export interface AtlasDatabaseTarget {
  type: 'postgresql' | 'mysql';
  connectionString: string | null;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  username: string | null;
  password: string | null;
}

export function isAtlasDatabaseTarget(database: { type: string }): database is AtlasDatabaseTarget {
  return database.type === 'postgresql' || database.type === 'mysql';
}

export interface PreparedAtlasMigrationWorkspace {
  dir: string;
  files: AtlasMigrationFile[];
  migrationDir: string;
  cleanup: () => Promise<void>;
}

export interface AtlasSchemaDiffResult {
  hasChanges: boolean;
  diffSql: string;
}

export function parseAtlasMigrationDir(configContent: string | null | undefined): string | null {
  if (!configContent) {
    return null;
  }

  const migrationBlockMatch = configContent.match(
    /migration\s*\{[\s\S]*?dir\s*=\s*"file:\/\/([^"\n]+)"/u
  );
  if (migrationBlockMatch?.[1]) {
    return migrationBlockMatch[1].trim();
  }

  const directMatch = configContent.match(/dir\s*=\s*"file:\/\/([^"\n]+)"/u);
  return directMatch?.[1]?.trim() || null;
}

export function extractAtlasMigrationVersion(fileName: string): string | null {
  const normalized = fileName.trim();
  const match = normalized.match(/^(\d+)(?:_|\.sql$)/u);
  return match?.[1] ?? null;
}

export function getAtlasDeclaredVersions(files: Array<{ name: string }>): string[] {
  return files
    .map((file) => extractAtlasMigrationVersion(file.name))
    .filter((version): version is string => Boolean(version));
}

export function resolveAtlasDatabaseUrl(database: AtlasDatabaseTarget): string | null {
  if (database.connectionString) {
    if (database.type === 'postgresql') {
      return normalizeAtlasDatabaseUrl(normalizeDatabaseUrl(database.connectionString));
    }

    return normalizeAtlasDatabaseUrl(database.connectionString.trim());
  }

  if (!database.host || !database.databaseName || !database.username) {
    return null;
  }

  if (database.type === 'postgresql') {
    return normalizeAtlasDatabaseUrl(
      buildNormalizedPostgresUrl({
        username: database.username,
        password: database.password,
        host: database.host,
        port: database.port,
        databaseName: database.databaseName,
      })
    );
  }

  const username = encodeURIComponent(database.username);
  const password = encodeURIComponent(database.password ?? '');
  const auth = database.password ? `${username}:${password}` : username;
  const port = database.port ? `:${database.port}` : '';

  return normalizeAtlasDatabaseUrl(
    `mysql://${auth}@${database.host}${port}/${encodeURIComponent(database.databaseName)}`
  );
}

export function getDefaultAtlasDevUrl(databaseType: AtlasDatabaseTarget['type']): string {
  return databaseType === 'postgresql' ? 'docker://postgres/16/dev' : 'docker://mysql/8/dev';
}

export function getAtlasSchemaDiffExcludePatterns(
  databaseType: AtlasDatabaseTarget['type']
): string[] {
  if (databaseType === 'postgresql') {
    return ['*.atlas_schema_revisions', 'drizzle.__drizzle_migrations'];
  }

  return ['*.atlas_schema_revisions', '*.__drizzle_migrations'];
}

export function summarizeAtlasSchemaDiffOutput(diffSql: string): string | null {
  const firstMeaningfulLine = diffSql
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine ?? null;
}

async function ensureAtlasWorkspaceChecksumFile(dir: string): Promise<void> {
  await runAtlasCommand(['migrate', 'hash', '--dir', 'file://migrations'], {
    cwd: dir,
  });
}

export async function prepareAtlasMigrationWorkspace(input: {
  projectId: string;
  migrationPath: string;
  revision: string;
}): Promise<PreparedAtlasMigrationWorkspace> {
  const files = (
    await fetchMigrationFilesFromRepoPath(input.projectId, input.migrationPath, input.revision)
  ).filter((file) => file.name.endsWith('.sql'));

  const dir = await mkdtemp(path.join(tmpdir(), 'juanie-atlas-'));
  const migrationDir = path.join(dir, 'migrations');
  await mkdir(migrationDir, { recursive: true });

  const atlasSum = await readRepositoryFileFromRepoPath(
    input.projectId,
    `${input.migrationPath}/atlas.sum`,
    input.revision
  );

  for (const file of files) {
    await writeFile(path.join(migrationDir, file.name), file.content, 'utf8');
  }

  if (atlasSum) {
    await writeFile(path.join(migrationDir, 'atlas.sum'), atlasSum, 'utf8');
  } else if (files.length > 0) {
    await ensureAtlasWorkspaceChecksumFile(dir);
  }

  return {
    dir,
    files,
    migrationDir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function diffDatabaseSchemaAgainstMigrationDir(input: {
  database: AtlasDatabaseTarget;
  projectId: string;
  migrationPath: string;
  revision: string;
}): Promise<AtlasSchemaDiffResult> {
  const databaseUrl = resolveAtlasDatabaseUrl(input.database);
  if (!databaseUrl) {
    throw new Error('数据库缺少可用的连接信息，无法执行 Atlas schema diff');
  }

  const workspace = await prepareAtlasMigrationWorkspace({
    projectId: input.projectId,
    migrationPath: input.migrationPath,
    revision: input.revision,
  });

  try {
    if (workspace.files.length === 0) {
      return {
        hasChanges: false,
        diffSql: '',
      };
    }

    const args = [
      'schema',
      'diff',
      '--from',
      databaseUrl,
      '--to',
      'file://migrations',
      '--dev-url',
      getDefaultAtlasDevUrl(input.database.type),
      '--format',
      '{{ sql . }}',
      ...getAtlasSchemaDiffExcludePatterns(input.database.type).flatMap((pattern) => [
        '--exclude',
        pattern,
      ]),
    ];

    const { stdout } = await runAtlasCommand(args, {
      cwd: workspace.dir,
    });
    const diffSql = stdout.trim();

    return {
      hasChanges: diffSql.length > 0,
      diffSql,
    };
  } finally {
    await workspace.cleanup();
  }
}

async function getAppliedAtlasVersionsPostgres(connectionString: string): Promise<string[]> {
  const client = new PgClient({ connectionString });
  await client.connect();

  try {
    const table = await client.query<{ regclass: string | null }>(
      `SELECT to_regclass('atlas_schema_revisions') AS regclass`
    );

    if (!table.rows[0]?.regclass) {
      return [];
    }

    const result = await client.query<{ version: string }>(
      `SELECT version
       FROM atlas_schema_revisions
       WHERE (applied IS NULL OR total IS NULL OR applied = total)
         AND (error IS NULL OR error = '')
       ORDER BY version ASC`
    );

    return result.rows.map((row) => row.version).filter(Boolean);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function getAppliedAtlasVersionsMySql(connectionString: string): Promise<string[]> {
  const connection = await mysql.createConnection({
    uri: connectionString,
  });

  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = ?`,
      [ATLAS_REVISIONS_TABLE]
    );

    if (Number((tables as Array<{ count: number }>)[0]?.count ?? 0) === 0) {
      return [];
    }

    const [rows] = await connection.query(
      `SELECT version
       FROM atlas_schema_revisions
       WHERE (applied IS NULL OR total IS NULL OR applied = total)
         AND (error IS NULL OR error = '')
       ORDER BY version ASC`
    );

    return (rows as Array<{ version: string }>).map((row) => row.version).filter(Boolean);
  } finally {
    await connection.end().catch(() => undefined);
  }
}

export async function getAppliedAtlasVersions(database: AtlasDatabaseTarget): Promise<string[]> {
  const connectionString = resolveAtlasDatabaseUrl(database);
  if (!connectionString) {
    throw new Error('数据库缺少可用的连接信息，无法读取 Atlas 执行状态');
  }

  if (database.type === 'postgresql') {
    return getAppliedAtlasVersionsPostgres(connectionString);
  }

  return getAppliedAtlasVersionsMySql(connectionString);
}

async function hasUserTablesPostgres(connectionString: string): Promise<boolean> {
  const client = new PgClient({ connectionString });
  await client.connect();

  try {
    const result = await client.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = COALESCE(current_schema(), 'public')
         AND table_type = 'BASE TABLE'
         AND table_name <> $1`,
      [ATLAS_REVISIONS_TABLE]
    );

    const rawValue = result.rows[0]?.count ?? 0;
    const count = typeof rawValue === 'number' ? rawValue : Number.parseInt(String(rawValue), 10);
    return Number.isFinite(count) && count > 0;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function hasUserTablesMySql(connectionString: string): Promise<boolean> {
  const connection = await mysql.createConnection({
    uri: connectionString,
  });

  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'
         AND table_name <> ?`,
      [ATLAS_REVISIONS_TABLE]
    );

    return Number((rows as Array<{ count: number }>)[0]?.count ?? 0) > 0;
  } finally {
    await connection.end().catch(() => undefined);
  }
}

export async function hasAtlasUserTables(database: AtlasDatabaseTarget): Promise<boolean> {
  const connectionString = resolveAtlasDatabaseUrl(database);
  if (!connectionString) {
    throw new Error('数据库缺少可用的连接信息，无法检查 Atlas 业务表');
  }

  if (database.type === 'postgresql') {
    return hasUserTablesPostgres(connectionString);
  }

  return hasUserTablesMySql(connectionString);
}
