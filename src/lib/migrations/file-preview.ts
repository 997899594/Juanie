import { and, eq, inArray } from 'drizzle-orm';
import { Client as PgClient } from 'pg';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';
import { extractAtlasMigrationVersion, getAppliedAtlasVersions } from '@/lib/migrations/atlas';
import {
  fetchMigrationFilesFromRepoPath,
  listRepositoryDirectoryFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';
import { getDefaultMigrationPath } from '@/lib/migrations/path';

const FILE_EXTENSIONS = ['.sql', '.js', '.ts', '.mjs', '.cjs'];
const MAX_PREVIEW_FILES = 12;
const MAX_PRISMA_DIRS = 24;
const PREVIEW_CACHE_TTL_MS = Math.max(
  Number(process.env.MIGRATION_PREVIEW_CACHE_TTL_MS ?? '45000'),
  1000
);
const PREVIEW_TIMEOUT_MS = Math.max(
  Number(process.env.MIGRATION_PREVIEW_TIMEOUT_MS ?? '5000'),
  1000
);
const PREVIEW_CACHE_MAX_ENTRIES = Math.max(
  Number(process.env.MIGRATION_PREVIEW_CACHE_MAX_ENTRIES ?? '500'),
  50
);
const SUPPORTED_MIGRATION_TOOLS = [
  'atlas',
  'drizzle',
  'prisma',
  'knex',
  'typeorm',
  'sql',
  'custom',
] as const;
const SUPPORTED_DATABASE_TYPES = ['postgresql', 'mysql', 'redis', 'mongodb'] as const;

export interface MigrationFilePreviewSnapshot {
  sourceLabel: string;
  files: string[];
  total: number;
  declaredTotal: number;
  executedTotal: number;
  truncated: boolean;
  warning?: string | null;
}

interface MigrationFilePreviewRunLike {
  id: string;
  projectId: string;
  specification?: {
    tool?: string | null;
    migrationPath?: string | null;
  } | null;
  database?: {
    id?: string | null;
    type?: string | null;
    connectionString?: string | null;
  } | null;
  release?: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  } | null;
  environment?: {
    branch?: string | null;
  } | null;
}

interface DeclaredMigrationPreview {
  sourceLabel: string;
  declaredFiles: string[];
  warning?: string | null;
}

interface BuildPreviewOptions {
  forceRefresh?: boolean;
}

type SupportedMigrationTool = (typeof SUPPORTED_MIGRATION_TOOLS)[number];
type SupportedDatabaseType = (typeof SUPPORTED_DATABASE_TYPES)[number];

interface CachedPreviewEntry {
  value: DeclaredMigrationPreview | null;
  expiresAt: number;
}

interface ExecutionStateSnapshot {
  mode: 'names' | 'ordered_count' | 'versions' | 'unknown';
  executedNames?: Set<string>;
  executedCount?: number;
  executedVersions?: Set<string>;
  warning?: string | null;
}

function isMissingPostgresRelation(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === '42P01') {
    return true;
  }

  const message = (maybeError.message ?? '').toLowerCase();
  return message.includes('does not exist') && message.includes(tableName.toLowerCase());
}

class PreviewTimeoutError extends Error {
  constructor(
    readonly operation: string,
    readonly timeoutMs: number
  ) {
    super(`${operation} 超时（>${timeoutMs}ms）`);
    this.name = 'PreviewTimeoutError';
  }
}

const previewCache = new Map<string, CachedPreviewEntry>();
const previewInFlight = new Map<string, Promise<DeclaredMigrationPreview | null>>();

function asSupportedMigrationTool(value?: string | null): SupportedMigrationTool | null {
  if (!value) return null;
  return SUPPORTED_MIGRATION_TOOLS.includes(value as SupportedMigrationTool)
    ? (value as SupportedMigrationTool)
    : null;
}

function asSupportedDatabaseType(value?: string | null): SupportedDatabaseType | null {
  if (!value) return null;
  return SUPPORTED_DATABASE_TYPES.includes(value as SupportedDatabaseType)
    ? (value as SupportedDatabaseType)
    : null;
}

function now(): number {
  return Date.now();
}

function normalizeRefValue(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRevision(run: MigrationFilePreviewRunLike): string {
  return (
    normalizeRefValue(run.release?.sourceCommitSha) ??
    normalizeRefValue(run.release?.sourceRef) ??
    normalizeRefValue(run.environment?.branch) ??
    'main'
  );
}

function mergeWarnings(...warnings: Array<string | null | undefined>): string | null {
  const values = warnings
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return null;
  }

  return Array.from(new Set(values)).join('；');
}

function normalizeFileList(files: string[]): string[] {
  const uniqueFiles: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const normalized = file.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueFiles.push(normalized);
  }

  return uniqueFiles;
}

function buildDeclaredPreview(
  sourceLabel: string,
  files: string[],
  warning?: string | null
): DeclaredMigrationPreview {
  return {
    sourceLabel,
    declaredFiles: normalizeFileList(files),
    warning: warning ?? null,
  };
}

function buildPendingSnapshot(input: {
  declaredPreview: DeclaredMigrationPreview;
  pendingFiles: string[];
  executedTotal: number;
  warning?: string | null;
}): MigrationFilePreviewSnapshot {
  const declaredTotal = input.declaredPreview.declaredFiles.length;
  const normalizedPending = normalizeFileList(input.pendingFiles);

  return {
    sourceLabel: input.declaredPreview.sourceLabel,
    files: normalizedPending.slice(0, MAX_PREVIEW_FILES),
    total: normalizedPending.length,
    declaredTotal,
    executedTotal: Math.min(Math.max(input.executedTotal, 0), declaredTotal),
    truncated: normalizedPending.length > MAX_PREVIEW_FILES,
    warning: mergeWarnings(input.declaredPreview.warning, input.warning),
  };
}

function prunePreviewCache(): void {
  const current = now();

  for (const [key, entry] of previewCache) {
    if (entry.expiresAt <= current) {
      previewCache.delete(key);
    }
  }

  while (previewCache.size > PREVIEW_CACHE_MAX_ENTRIES) {
    const firstKey = previewCache.keys().next().value;
    if (!firstKey) {
      break;
    }
    previewCache.delete(firstKey);
  }
}

function createDeclaredPreviewCacheKey(input: {
  projectId: string;
  tool: SupportedMigrationTool;
  migrationPath: string;
  revision: string;
}): string {
  return `${input.projectId}:${input.tool}:${input.migrationPath}:${input.revision}`;
}

export function invalidateMigrationFilePreviewCache(input?: { projectId?: string | null }): void {
  if (!input?.projectId) {
    previewCache.clear();
    previewInFlight.clear();
    return;
  }

  const prefix = `${input.projectId}:`;
  for (const key of previewCache.keys()) {
    if (key.startsWith(prefix)) {
      previewCache.delete(key);
    }
  }

  for (const key of previewInFlight.keys()) {
    if (key.startsWith(prefix)) {
      previewInFlight.delete(key);
    }
  }
}

function getCachedDeclaredPreview(cacheKey: string): DeclaredMigrationPreview | null | undefined {
  const entry = previewCache.get(cacheKey);
  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= now()) {
    previewCache.delete(cacheKey);
    return undefined;
  }

  return entry.value;
}

function setCachedDeclaredPreview(cacheKey: string, value: DeclaredMigrationPreview | null): void {
  previewCache.set(cacheKey, {
    value,
    expiresAt: now() + PREVIEW_CACHE_TTL_MS,
  });
  prunePreviewCache();
}

async function withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new PreviewTimeoutError(operation, PREVIEW_TIMEOUT_MS));
        }, PREVIEW_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isMigrationFile(name: string): boolean {
  return FILE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function resolvePath(run: MigrationFilePreviewRunLike): string | null {
  const tool = asSupportedMigrationTool(run.specification?.tool);
  if (!tool) {
    return null;
  }

  if (run.specification?.migrationPath && run.specification.migrationPath.trim().length > 0) {
    return run.specification.migrationPath;
  }

  const databaseType = asSupportedDatabaseType(run.database?.type);
  if (!databaseType) {
    return null;
  }

  return getDefaultMigrationPath(tool, databaseType);
}

function parseDrizzleJournal(content: string): string[] {
  const parsed = JSON.parse(content) as
    | {
        entries?: Array<{
          tag?: string;
        }>;
      }
    | Array<{ tag?: string }>;

  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.entries)
      ? parsed.entries
      : [];

  return entries
    .map((entry) => entry?.tag?.trim())
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => (tag.endsWith('.sql') ? tag : `${tag}.sql`));
}

async function resolveSqlDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string
): Promise<DeclaredMigrationPreview> {
  const files = await withTimeout(
    fetchMigrationFilesFromRepoPath(projectId, migrationPath, revision),
    '读取 SQL 迁移目录'
  );

  return buildDeclaredPreview(
    'SQL 目录',
    files.map((file) => file.name)
  );
}

async function resolveDrizzleDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string
): Promise<DeclaredMigrationPreview> {
  const journalPath = `${migrationPath.replace(/\/$/, '')}/meta/_journal.json`;

  try {
    const journalContent = await withTimeout(
      readRepositoryFileFromRepoPath(projectId, journalPath, revision),
      '读取 Drizzle journal'
    );
    if (journalContent) {
      const files = parseDrizzleJournal(journalContent);
      if (files.length > 0) {
        return buildDeclaredPreview('Drizzle 元数据', files);
      }
    }
  } catch (_error) {
    // Fall back to directory scan.
  }

  const entries = await withTimeout(
    listRepositoryDirectoryFromRepoPath(projectId, migrationPath, revision),
    '扫描 Drizzle 迁移目录'
  );
  const files = entries
    .filter((entry) => entry.type === 'file' && isMigrationFile(entry.name))
    .map((entry) => entry.name);

  return buildDeclaredPreview(
    'Drizzle 目录扫描',
    files,
    files.length === 0 ? '未在 Drizzle 路径下检测到迁移文件，请确认目录结构。' : null
  );
}

async function resolvePrismaDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string
): Promise<DeclaredMigrationPreview> {
  const entries = await withTimeout(
    listRepositoryDirectoryFromRepoPath(projectId, migrationPath, revision),
    '扫描 Prisma 迁移目录'
  );
  const migrationDirs = entries.filter((entry) => entry.type === 'dir');

  const scannedDirs = migrationDirs.slice(0, MAX_PRISMA_DIRS);
  const files = await Promise.all(
    scannedDirs.map(async (directory) => {
      const nestedEntries = await withTimeout(
        listRepositoryDirectoryFromRepoPath(projectId, directory.path, revision),
        `扫描 Prisma 目录 ${directory.name}`
      );
      const migrationSql = nestedEntries.find(
        (entry) => entry.type === 'file' && entry.name === 'migration.sql'
      );
      if (migrationSql) {
        return `${directory.name}/migration.sql`;
      }

      const firstMigrationFile = nestedEntries.find(
        (entry) => entry.type === 'file' && isMigrationFile(entry.name)
      );
      return firstMigrationFile ? `${directory.name}/${firstMigrationFile.name}` : null;
    })
  );

  const warning =
    migrationDirs.length > MAX_PRISMA_DIRS
      ? `Prisma 迁移目录较多，仅扫描前 ${MAX_PRISMA_DIRS} 项。`
      : null;

  return buildDeclaredPreview(
    'Prisma 目录',
    files.filter((file): file is string => Boolean(file)),
    warning
  );
}

async function resolveGenericDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string
): Promise<DeclaredMigrationPreview> {
  const entries = await withTimeout(
    listRepositoryDirectoryFromRepoPath(projectId, migrationPath, revision),
    '扫描迁移目录'
  );
  const files = entries
    .filter((entry) => entry.type === 'file' && isMigrationFile(entry.name))
    .map((entry) => entry.name);

  return buildDeclaredPreview('迁移目录', files);
}

async function resolveAtlasDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string
): Promise<DeclaredMigrationPreview> {
  const files = await withTimeout(
    fetchMigrationFilesFromRepoPath(projectId, migrationPath, revision),
    '读取 Atlas 迁移目录'
  );

  return buildDeclaredPreview(
    'Atlas 目录',
    files.filter((file) => file.name.endsWith('.sql')).map((file) => file.name)
  );
}

async function resolveDeclaredPreviewForRun(
  run: MigrationFilePreviewRunLike
): Promise<DeclaredMigrationPreview | null> {
  const tool = asSupportedMigrationTool(run.specification?.tool);
  const migrationPath = resolvePath(run);
  if (!tool || !migrationPath) {
    return null;
  }

  const revision = resolveRevision(run);
  if (tool === 'sql') {
    return resolveSqlDeclaredPreview(run.projectId, migrationPath, revision);
  }
  if (tool === 'atlas') {
    return resolveAtlasDeclaredPreview(run.projectId, migrationPath, revision);
  }
  if (tool === 'drizzle') {
    return resolveDrizzleDeclaredPreview(run.projectId, migrationPath, revision);
  }
  if (tool === 'prisma') {
    return resolvePrismaDeclaredPreview(run.projectId, migrationPath, revision);
  }

  return resolveGenericDeclaredPreview(run.projectId, migrationPath, revision);
}

async function loadPlatformExecutedNamesByDatabase(
  databaseIds: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();

  if (databaseIds.length === 0) {
    return map;
  }

  const rows = await db.query.databaseMigrations.findMany({
    where: and(
      inArray(databaseMigrations.databaseId, databaseIds),
      eq(databaseMigrations.status, 'success')
    ),
    columns: {
      databaseId: true,
      filename: true,
    },
  });

  for (const row of rows) {
    const existing = map.get(row.databaseId) ?? new Set<string>();
    existing.add(row.filename);
    map.set(row.databaseId, existing);
  }

  return map;
}

async function withPostgresClient<T>(
  connectionString: string,
  operation: string,
  runner: (client: PgClient) => Promise<T>
): Promise<T> {
  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: Math.min(PREVIEW_TIMEOUT_MS, 3000),
  });

  try {
    await withTimeout(client.connect(), `${operation}（连接）`);
    return await withTimeout(runner(client), operation);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function resolvePostgresExecutionState(input: {
  tool: SupportedMigrationTool;
  connectionString: string;
}): Promise<ExecutionStateSnapshot> {
  const { tool } = input;

  if (tool === 'prisma') {
    let names: string[] = [];
    try {
      names = await withPostgresClient(
        input.connectionString,
        '读取 Prisma 执行状态',
        async (client) => {
          const result = await client.query<{ migration_name: string }>(
            'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
          );
          return result.rows.map((row) => row.migration_name);
        }
      );
    } catch (error) {
      if (!isMissingPostgresRelation(error, '_prisma_migrations')) {
        throw error;
      }

      return {
        mode: 'names',
        executedNames: new Set<string>(),
        warning: '首次迁移，Prisma 执行记录表尚未创建，按 0 已执行处理。',
      };
    }

    return {
      mode: 'names',
      executedNames: new Set(normalizeFileList(names.map((name) => `${name}/migration.sql`))),
    };
  }

  if (tool === 'knex') {
    let names: string[] = [];
    try {
      names = await withPostgresClient(
        input.connectionString,
        '读取 Knex 执行状态',
        async (client) => {
          const result = await client.query<{ name: string }>('SELECT name FROM knex_migrations');
          return result.rows.map((row) => row.name);
        }
      );
    } catch (error) {
      if (!isMissingPostgresRelation(error, 'knex_migrations')) {
        throw error;
      }

      return {
        mode: 'names',
        executedNames: new Set<string>(),
        warning: '首次迁移，Knex 执行记录表尚未创建，按 0 已执行处理。',
      };
    }

    return {
      mode: 'names',
      executedNames: new Set(normalizeFileList(names)),
    };
  }

  if (tool === 'typeorm') {
    let names: string[] = [];
    try {
      names = await withPostgresClient(
        input.connectionString,
        '读取 TypeORM 执行状态',
        async (client) => {
          const result = await client.query<{ name: string }>('SELECT name FROM migrations');
          return result.rows.map((row) => row.name);
        }
      );
    } catch (error) {
      if (!isMissingPostgresRelation(error, 'migrations')) {
        throw error;
      }

      return {
        mode: 'names',
        executedNames: new Set<string>(),
        warning: '首次迁移，TypeORM 执行记录表尚未创建，按 0 已执行处理。',
      };
    }

    return {
      mode: 'names',
      executedNames: new Set(normalizeFileList(names)),
    };
  }

  if (tool === 'drizzle') {
    let executedCount = 0;
    try {
      executedCount = await withPostgresClient(
        input.connectionString,
        '读取 Drizzle 执行状态',
        async (client) => {
          const result = await client.query<{ count: string | number }>(
            'SELECT COUNT(*) AS count FROM "__drizzle_migrations"'
          );
          const rawValue = result.rows[0]?.count ?? 0;
          const count =
            typeof rawValue === 'number' ? rawValue : Number.parseInt(String(rawValue), 10);
          return Number.isNaN(count) ? 0 : count;
        }
      );
    } catch (error) {
      if (!isMissingPostgresRelation(error, '__drizzle_migrations')) {
        throw error;
      }

      return {
        mode: 'ordered_count',
        executedCount: 0,
        warning: '首次迁移，Drizzle 执行记录表尚未创建，按 0 已执行处理。',
      };
    }

    return {
      mode: 'ordered_count',
      executedCount: Math.max(executedCount, 0),
    };
  }

  return {
    mode: 'unknown',
    warning: '当前迁移工具暂不支持读取实时执行状态。',
  };
}

async function resolveRuntimeExecutionState(
  run: MigrationFilePreviewRunLike,
  tool: SupportedMigrationTool
): Promise<ExecutionStateSnapshot> {
  if (tool === 'atlas') {
    if (run.database?.type !== 'postgresql' && run.database?.type !== 'mysql') {
      return {
        mode: 'unknown',
        warning: '当前仅支持 PostgreSQL / MySQL 的 Atlas 执行状态读取。',
      };
    }

    const connectionString = normalizeRefValue(run.database.connectionString);
    if (!connectionString) {
      return {
        mode: 'unknown',
        warning: '数据库连接串缺失，无法读取 Atlas 执行状态。',
      };
    }

    try {
      const versions = await getAppliedAtlasVersions({
        type: run.database.type,
        connectionString,
        host: null,
        port: null,
        databaseName: null,
        username: null,
        password: null,
      });

      return {
        mode: 'versions',
        executedVersions: new Set(versions),
      };
    } catch (error) {
      return {
        mode: 'unknown',
        warning: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (run.database?.type !== 'postgresql') {
    return {
      mode: 'unknown',
      warning: '当前仅支持 PostgreSQL 的实时执行状态读取。',
    };
  }

  const connectionString = normalizeRefValue(run.database.connectionString);
  if (!connectionString) {
    return {
      mode: 'unknown',
      warning: '数据库连接串缺失，无法读取实时执行状态。',
    };
  }

  try {
    return await resolvePostgresExecutionState({ tool, connectionString });
  } catch (error) {
    const warning =
      error instanceof PreviewTimeoutError
        ? `${error.operation}超时，已降级为仅显示声明文件。`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      mode: 'unknown',
      warning,
    };
  }
}

function applyExecutionState(input: {
  declaredPreview: DeclaredMigrationPreview;
  executionState: ExecutionStateSnapshot;
}): MigrationFilePreviewSnapshot {
  const declaredFiles = input.declaredPreview.declaredFiles;

  if (input.executionState.mode === 'names') {
    const executed = input.executionState.executedNames ?? new Set<string>();
    const pending = declaredFiles.filter((file) => !executed.has(file));
    const executedTotal = declaredFiles.length - pending.length;

    return buildPendingSnapshot({
      declaredPreview: input.declaredPreview,
      pendingFiles: pending,
      executedTotal,
      warning: input.executionState.warning,
    });
  }

  if (input.executionState.mode === 'ordered_count') {
    const executedTotal = Math.min(
      Math.max(input.executionState.executedCount ?? 0, 0),
      declaredFiles.length
    );
    const pending = declaredFiles.slice(executedTotal);

    return buildPendingSnapshot({
      declaredPreview: input.declaredPreview,
      pendingFiles: pending,
      executedTotal,
      warning: input.executionState.warning,
    });
  }

  if (input.executionState.mode === 'versions') {
    const executedVersions = input.executionState.executedVersions ?? new Set<string>();
    const pending = declaredFiles.filter((file) => {
      const version = extractAtlasMigrationVersion(file);
      return !version || !executedVersions.has(version);
    });
    const executedTotal = declaredFiles.length - pending.length;

    return buildPendingSnapshot({
      declaredPreview: input.declaredPreview,
      pendingFiles: pending,
      executedTotal,
      warning: input.executionState.warning,
    });
  }

  return buildPendingSnapshot({
    declaredPreview: input.declaredPreview,
    pendingFiles: declaredFiles,
    executedTotal: 0,
    warning: input.executionState.warning,
  });
}

async function resolveDeclaredPreviewWithCache(input: {
  run: MigrationFilePreviewRunLike;
  tool: SupportedMigrationTool;
  migrationPath: string;
  revision: string;
  forceRefresh: boolean;
}): Promise<DeclaredMigrationPreview | null> {
  const cacheKey = createDeclaredPreviewCacheKey({
    projectId: input.run.projectId,
    tool: input.tool,
    migrationPath: input.migrationPath,
    revision: input.revision,
  });

  if (!input.forceRefresh) {
    const cachedPreview = getCachedDeclaredPreview(cacheKey);
    if (cachedPreview !== undefined) {
      return cachedPreview;
    }
  }

  if (!input.forceRefresh) {
    const inFlight = previewInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const resolving = (async () => {
    try {
      return await resolveDeclaredPreviewForRun(input.run);
    } catch (error) {
      const warning =
        error instanceof PreviewTimeoutError
          ? `${error.operation}超时，已降级为仅显示命令。`
          : error instanceof Error
            ? error.message
            : String(error);

      return buildDeclaredPreview('迁移目录', [], warning);
    } finally {
      previewInFlight.delete(cacheKey);
    }
  })();

  previewInFlight.set(cacheKey, resolving);
  const resolved = await resolving;
  setCachedDeclaredPreview(cacheKey, resolved);
  return resolved;
}

export async function buildMigrationFilePreviewByRunId(
  runs: MigrationFilePreviewRunLike[],
  options: BuildPreviewOptions = {}
): Promise<Map<string, MigrationFilePreviewSnapshot>> {
  const previewByRunId = new Map<string, MigrationFilePreviewSnapshot>();
  const localDeclaredPreview = new Map<string, DeclaredMigrationPreview | null>();
  const runtimeExecutionStateByKey = new Map<string, ExecutionStateSnapshot>();
  const forceRefresh = options.forceRefresh ?? false;

  const databaseIds = Array.from(
    new Set(
      runs
        .map((run) => normalizeRefValue(run.database?.id))
        .filter((databaseId): databaseId is string => Boolean(databaseId))
    )
  );
  const platformExecutedByDatabase = await loadPlatformExecutedNamesByDatabase(databaseIds);

  for (const run of runs) {
    const tool = asSupportedMigrationTool(run.specification?.tool);
    const migrationPath = resolvePath(run);
    const revision = resolveRevision(run);
    if (!tool || !migrationPath) {
      continue;
    }

    const cacheKey = createDeclaredPreviewCacheKey({
      projectId: run.projectId,
      tool,
      migrationPath,
      revision,
    });

    let declaredPreview = localDeclaredPreview.get(cacheKey);
    if (declaredPreview === undefined) {
      declaredPreview = await resolveDeclaredPreviewWithCache({
        run,
        tool,
        migrationPath,
        revision,
        forceRefresh,
      });
      localDeclaredPreview.set(cacheKey, declaredPreview);
    }

    if (!declaredPreview) {
      continue;
    }

    const databaseId = normalizeRefValue(run.database?.id);
    if (!databaseId) {
      previewByRunId.set(
        run.id,
        buildPendingSnapshot({
          declaredPreview,
          pendingFiles: declaredPreview.declaredFiles,
          executedTotal: 0,
          warning: '数据库标识缺失，无法计算待执行状态。',
        })
      );
      continue;
    }

    if (tool === 'sql') {
      const executedNames = platformExecutedByDatabase.get(databaseId) ?? new Set<string>();
      previewByRunId.set(
        run.id,
        applyExecutionState({
          declaredPreview,
          executionState: {
            mode: 'names',
            executedNames,
          },
        })
      );
      continue;
    }

    const runtimeKey = `${databaseId}:${tool}`;
    let executionState = runtimeExecutionStateByKey.get(runtimeKey);
    if (!executionState) {
      executionState = await resolveRuntimeExecutionState(run, tool);
      runtimeExecutionStateByKey.set(runtimeKey, executionState);
    }

    previewByRunId.set(
      run.id,
      applyExecutionState({
        declaredPreview,
        executionState,
      })
    );
  }

  return previewByRunId;
}
