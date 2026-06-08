import { and, eq, inArray } from 'drizzle-orm';
import { Client as PgClient } from 'pg';
import { db } from '@/lib/db';
import {
  databaseMigrations,
  type MigrationRunStatus,
  migrationRunStatuses,
  migrationRuns,
} from '@/lib/db/schema';
import {
  diffDatabaseSchemaAgainstDesiredSchema,
  extractAtlasMigrationVersion,
  getAppliedAtlasVersions,
  isAtlasDatabaseTarget,
} from '@/lib/migrations/atlas';
import { exportDesiredSchemaFromRepository } from '@/lib/migrations/desired-schema';
import {
  fetchMigrationFilesFromRepoPath,
  listRepositoryDirectoryFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';
import type {
  MigrationFileExecutionPlan,
  MigrationFilePreviewDetail,
  MigrationFilePreviewSnapshot,
} from '@/lib/migrations/file-preview-types';
import { getDefaultMigrationPath } from '@/lib/migrations/path';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';

const FILE_EXTENSIONS = ['.sql', '.js', '.ts', '.mjs', '.cjs'];
const MAX_PREVIEW_FILES = 12;
const MAX_PREVIEW_CONTENT_BYTES = Math.max(
  Number(process.env.MIGRATION_PREVIEW_CONTENT_BYTES ?? '16384'),
  1024
);
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

export type { MigrationFilePreviewDetail, MigrationFilePreviewSnapshot };

export type MigrationPendingState = 'pending' | 'none' | 'unknown';

export interface MigrationPendingInspection {
  state: MigrationPendingState;
  preview: MigrationFilePreviewSnapshot | null;
}

interface MigrationFilePreviewRunLike {
  id: string;
  projectId: string;
  specification?: {
    tool?: string | null;
    migrationPath?: string | null;
    sourceConfigPath?: string | null;
  } | null;
  database?: {
    id?: string | null;
    type?: string | null;
    connectionString?: string | null;
    capabilities?: readonly string[] | null;
  } | null;
  status?: string | null;
  filePreview?: MigrationFilePreviewSnapshot | null;
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
  declaredFileDetails?: Map<string, MigrationFilePreviewDetail>;
  warning?: string | null;
}

interface BuildPreviewOptions {
  forceRefresh?: boolean;
  executionStateMode?: 'live' | 'run_status' | 'declared_only';
  includeFileDetails?: boolean;
}

type SupportedMigrationTool = (typeof SUPPORTED_MIGRATION_TOOLS)[number];
type SupportedDatabaseType = (typeof SUPPORTED_DATABASE_TYPES)[number];

interface CachedPreviewEntry {
  value: DeclaredMigrationPreview | null;
  expiresAt: number;
}

interface ExecutionStateSnapshot {
  mode: 'names' | 'versions' | 'desired_schema' | 'unknown';
  executedNames?: Set<string>;
  executedVersions?: Set<string>;
  desiredSchemaAligned?: boolean;
  desiredSchemaPlan?: MigrationFileExecutionPlan | null;
  desiredSchemaPlanDetail?: MigrationFilePreviewDetail | null;
  desiredSchemaDetail?: MigrationFilePreviewDetail | null;
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

function asMigrationRunStatus(value?: string | null): MigrationRunStatus | null {
  if (!value) return null;
  return migrationRunStatuses.includes(value as MigrationRunStatus)
    ? (value as MigrationRunStatus)
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
  warning?: string | null,
  details?: Array<{ path: string; content: string }>
): DeclaredMigrationPreview {
  const declaredFiles = normalizeFileList(files);
  const declaredFileDetails = details
    ? new Map(
        details.map((detail) => {
          const normalizedPath = detail.path.trim();
          return [normalizedPath, buildFilePreviewDetail(normalizedPath, detail.content)];
        })
      )
    : undefined;

  return {
    sourceLabel,
    declaredFiles,
    declaredFileDetails,
    warning: warning ?? null,
  };
}

function getPreviewLanguage(pathname: string): MigrationFilePreviewDetail['language'] {
  if (pathname.endsWith('.sql')) return 'sql';
  if (pathname.endsWith('.ts')) return 'typescript';
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs') || pathname.endsWith('.cjs')) {
    return 'javascript';
  }
  return 'text';
}

function truncatePreviewContent(content: string): { content: string; truncated: boolean } {
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes <= MAX_PREVIEW_CONTENT_BYTES) {
    return { content, truncated: false };
  }

  let size = 0;
  let index = 0;
  for (const char of content) {
    const nextSize = size + Buffer.byteLength(char, 'utf8');
    if (nextSize > MAX_PREVIEW_CONTENT_BYTES) {
      break;
    }
    size = nextSize;
    index += char.length;
  }

  return {
    content: content.slice(0, index),
    truncated: true,
  };
}

function buildFilePreviewDetail(pathname: string, content: string): MigrationFilePreviewDetail {
  const truncated = truncatePreviewContent(content);
  return {
    path: pathname,
    content: truncated.content,
    truncated: truncated.truncated,
    language: getPreviewLanguage(pathname),
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeFilePreviewDetail(value: unknown): MigrationFilePreviewDetail | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const detail = value as Partial<MigrationFilePreviewDetail>;
  if (typeof detail.path !== 'string' || typeof detail.content !== 'string') {
    return null;
  }

  return {
    path: detail.path,
    content: detail.content,
    truncated: detail.truncated === true,
    language:
      detail.language === 'sql' ||
      detail.language === 'javascript' ||
      detail.language === 'typescript' ||
      detail.language === 'text'
        ? detail.language
        : getPreviewLanguage(detail.path),
  };
}

function normalizeFilePreviewDetails(value: unknown): MigrationFilePreviewDetail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const details = value
    .map((item) => normalizeFilePreviewDetail(item))
    .filter((item): item is MigrationFilePreviewDetail => Boolean(item));
  return details.length > 0 ? details : undefined;
}

function normalizeExecutionPlan(value: unknown): MigrationFileExecutionPlan | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const plan = value as Partial<MigrationFileExecutionPlan>;
  if (typeof plan.path !== 'string' || typeof plan.content !== 'string') {
    return null;
  }

  return {
    path: plan.path,
    content: plan.content,
    language: 'sql',
  };
}

function normalizeStoredMigrationFilePreviewSnapshot(
  value: unknown
): MigrationFilePreviewSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const snapshot = value as Partial<MigrationFilePreviewSnapshot>;
  if (typeof snapshot.sourceLabel !== 'string') {
    return null;
  }

  return {
    sourceLabel: snapshot.sourceLabel,
    files: normalizeStringArray(snapshot.files),
    fileDetails: normalizeFilePreviewDetails(snapshot.fileDetails),
    historyFiles: normalizeStringArray(snapshot.historyFiles),
    historyFileDetails: normalizeFilePreviewDetails(snapshot.historyFileDetails),
    executionPlan: normalizeExecutionPlan(snapshot.executionPlan),
    total: normalizeNumber(snapshot.total),
    declaredTotal: normalizeNumber(snapshot.declaredTotal),
    executedTotal: normalizeNumber(snapshot.executedTotal),
    truncated: snapshot.truncated === true,
    warning: typeof snapshot.warning === 'string' ? snapshot.warning : null,
  };
}

export function normalizeMigrationFilePreviewSnapshot(
  value: unknown
): MigrationFilePreviewSnapshot | null {
  return normalizeStoredMigrationFilePreviewSnapshot(value);
}

function buildRunStatusPreviewFromStoredSnapshot(input: {
  run: MigrationFilePreviewRunLike;
  storedPreview: MigrationFilePreviewSnapshot;
}): MigrationFilePreviewSnapshot {
  const status = asMigrationRunStatus(input.run.status);
  if (status !== 'success' && status !== 'skipped') {
    return input.storedPreview;
  }

  const historyFiles =
    input.storedPreview.historyFiles && input.storedPreview.historyFiles.length > 0
      ? input.storedPreview.historyFiles
      : input.storedPreview.files;
  const historyFileDetails =
    input.storedPreview.historyFileDetails && input.storedPreview.historyFileDetails.length > 0
      ? input.storedPreview.historyFileDetails
      : input.storedPreview.fileDetails;
  const declaredTotal = Math.max(
    input.storedPreview.declaredTotal,
    input.storedPreview.executedTotal,
    historyFiles.length
  );

  return {
    ...input.storedPreview,
    files: [],
    fileDetails: undefined,
    historyFiles,
    historyFileDetails,
    executionPlan: null,
    total: 0,
    declaredTotal,
    executedTotal: declaredTotal,
  };
}

function shouldRehydrateStoredDesiredSchemaPreview(input: {
  executionStateMode: BuildPreviewOptions['executionStateMode'];
  includeFileDetails: boolean;
  run: MigrationFilePreviewRunLike;
  storedPreview: MigrationFilePreviewSnapshot;
  tool: SupportedMigrationTool;
}): boolean {
  if (
    input.executionStateMode !== 'run_status' ||
    !input.includeFileDetails ||
    input.tool !== 'drizzle'
  ) {
    return false;
  }

  const status = asMigrationRunStatus(input.run.status);
  if (status !== 'success' && status !== 'skipped') {
    return false;
  }

  const hasDetails =
    (input.storedPreview.fileDetails?.length ?? 0) > 0 ||
    (input.storedPreview.historyFileDetails?.length ?? 0) > 0;
  if (hasDetails) {
    return false;
  }

  return (
    input.storedPreview.sourceLabel === 'Desired schema' && input.storedPreview.declaredTotal > 0
  );
}

function buildPendingSnapshot(input: {
  declaredPreview: DeclaredMigrationPreview;
  pendingFiles: string[];
  executedTotal: number;
  warning?: string | null;
  includeHistoryDetails?: boolean;
  executionPlan?: MigrationFileExecutionPlan | null;
}): MigrationFilePreviewSnapshot {
  const declaredTotal = input.declaredPreview.declaredFiles.length;
  const normalizedPending = normalizeFileList(input.pendingFiles);

  const pendingPreviewFiles = normalizedPending.slice(0, MAX_PREVIEW_FILES);
  const fileDetails = input.declaredPreview.declaredFileDetails
    ? pendingPreviewFiles
        .map((file) => input.declaredPreview.declaredFileDetails?.get(file))
        .filter((detail): detail is MigrationFilePreviewDetail => Boolean(detail))
    : undefined;

  return {
    sourceLabel: input.declaredPreview.sourceLabel,
    files: pendingPreviewFiles,
    fileDetails,
    historyFiles: input.includeHistoryDetails
      ? input.declaredPreview.declaredFiles.slice(0, MAX_PREVIEW_FILES)
      : undefined,
    historyFileDetails:
      input.includeHistoryDetails && input.declaredPreview.declaredFileDetails
        ? input.declaredPreview.declaredFiles
            .slice(0, MAX_PREVIEW_FILES)
            .map((file) => input.declaredPreview.declaredFileDetails?.get(file))
            .filter((detail): detail is MigrationFilePreviewDetail => Boolean(detail))
        : undefined,
    executionPlan: input.executionPlan ?? null,
    total: normalizedPending.length,
    declaredTotal,
    executedTotal: Math.min(Math.max(input.executedTotal, 0), declaredTotal),
    truncated: normalizedPending.length > MAX_PREVIEW_FILES,
    warning: mergeWarnings(input.declaredPreview.warning, input.warning),
  };
}

function resolveRunStatusExecutionState(input: {
  run: MigrationFilePreviewRunLike;
  declaredPreview: DeclaredMigrationPreview;
}): ExecutionStateSnapshot | null {
  const status = asMigrationRunStatus(input.run.status);
  if (!status) {
    return null;
  }

  return {
    mode: 'names',
    executedNames: new Set(
      status === 'success' || status === 'skipped' ? input.declaredPreview.declaredFiles : []
    ),
  };
}

export function resolveMigrationPendingState(
  preview: MigrationFilePreviewSnapshot | null
): MigrationPendingState {
  if (!preview) {
    return 'unknown';
  }

  if (preview.executionPlan?.content?.trim()) {
    return 'pending';
  }

  if (isDegradedEmptyPreview(preview)) {
    return 'unknown';
  }

  return preview.total > 0 ? 'pending' : 'none';
}

function isDegradedEmptyPreview(preview: MigrationFilePreviewSnapshot): boolean {
  return (
    preview.total === 0 &&
    preview.declaredTotal === 0 &&
    preview.executedTotal === 0 &&
    Boolean(preview.warning?.trim())
  );
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
  includeFileDetails: boolean;
}): string {
  const detailMode = input.includeFileDetails ? 'details' : 'names';
  return `${input.projectId}:${input.tool}:${input.migrationPath}:${input.revision}:${detailMode}`;
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

async function resolveRepositoryFilePreviewDetails(input: {
  projectId: string;
  migrationPath: string;
  revision: string;
  files: string[];
}): Promise<Array<{ path: string; content: string }>> {
  const details: Array<{ path: string; content: string }> = [];

  for (const file of input.files) {
    const content = await withTimeout(
      readRepositoryFileFromRepoPath(
        input.projectId,
        `${input.migrationPath.replace(/\/+$/u, '')}/${file}`,
        input.revision
      ),
      `读取迁移文件 ${file}`
    );

    if (content) {
      details.push({ path: file, content });
    }
  }

  return details;
}

function resolvePath(run: MigrationFilePreviewRunLike): string | null {
  const tool = asSupportedMigrationTool(run.specification?.tool);
  if (!tool) {
    return null;
  }

  if (tool === 'drizzle') {
    return normalizeRefValue(run.specification?.sourceConfigPath) ?? '__desired_schema_auto__';
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

async function resolveSqlDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string,
  includeFileDetails: boolean
): Promise<DeclaredMigrationPreview> {
  const files = await withTimeout(
    fetchMigrationFilesFromRepoPath(projectId, migrationPath, revision),
    '读取 SQL 迁移目录'
  );

  const migrationFiles = files.map((file) => file.name);
  return buildDeclaredPreview(
    'SQL 目录',
    migrationFiles,
    null,
    includeFileDetails
      ? files.map((file) => ({ path: file.name, content: file.content }))
      : undefined
  );
}

async function resolveDrizzleDeclaredPreview(
  run: MigrationFilePreviewRunLike,
  revision: string,
  includeFileDetails: boolean
): Promise<DeclaredMigrationPreview> {
  if (!includeFileDetails) {
    return buildDeclaredPreview('Desired schema', ['desired-schema.sql']);
  }

  const databaseTarget = {
    type: run.database?.type ?? 'redis',
    connectionString: normalizeRefValue(run.database?.connectionString),
    host: null,
    port: null,
    databaseName: null,
    username: null,
    password: null,
    capabilities: run.database?.capabilities ?? null,
  };

  if (!isAtlasDatabaseTarget(databaseTarget)) {
    return buildDeclaredPreview(
      'Desired schema',
      ['desired-schema.sql'],
      '当前仅支持 PostgreSQL / MySQL 的 desired schema 内容预览。'
    );
  }

  if (!databaseTarget.connectionString) {
    return buildDeclaredPreview(
      'Desired schema',
      ['desired-schema.sql'],
      '数据库连接串缺失，无法导出 desired schema 内容预览。'
    );
  }

  const exportPromise = exportDesiredSchemaFromRepository({
    projectId: run.projectId,
    source: 'drizzle',
    revision,
    sourceConfigPath: run.specification?.sourceConfigPath ?? null,
    connectionString: databaseTarget.connectionString,
    capabilities: databaseTarget.capabilities,
  });

  let desiredSchemaWarning: string | null = null;
  const desiredSchema = await withTimeout(exportPromise, '导出 Drizzle desired schema').catch(
    (error): null => {
      if (error instanceof PreviewTimeoutError) {
        void exportPromise.then((artifact) => artifact.cleanup()).catch(() => undefined);
      }

      desiredSchemaWarning =
        error instanceof PreviewTimeoutError
          ? `${error.operation}超时，已降级为仅显示 desired schema 文件名。`
          : error instanceof Error
            ? error.message
            : String(error);

      return null;
    }
  );

  if (!desiredSchema) {
    return buildDeclaredPreview(
      'Desired schema',
      ['desired-schema.sql'],
      desiredSchemaWarning ?? '导出 Drizzle desired schema 失败，已降级为仅显示文件名。'
    );
  }

  try {
    return buildDeclaredPreview('Desired schema', ['desired-schema.sql'], null, [
      { path: 'desired-schema.sql', content: desiredSchema.schemaSql },
    ]);
  } finally {
    await desiredSchema.cleanup();
  }
}

async function resolvePrismaDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string,
  includeFileDetails: boolean
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
    warning,
    includeFileDetails
      ? await resolveRepositoryFilePreviewDetails({
          projectId,
          migrationPath,
          revision,
          files: files.filter((file): file is string => Boolean(file)).slice(0, MAX_PREVIEW_FILES),
        })
      : undefined
  );
}

async function resolveGenericDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string,
  includeFileDetails: boolean
): Promise<DeclaredMigrationPreview> {
  const entries = await withTimeout(
    listRepositoryDirectoryFromRepoPath(projectId, migrationPath, revision),
    '扫描迁移目录'
  );
  const files = entries
    .filter((entry) => entry.type === 'file' && isMigrationFile(entry.name))
    .map((entry) => entry.name);

  return buildDeclaredPreview(
    '迁移目录',
    files,
    null,
    includeFileDetails
      ? await resolveRepositoryFilePreviewDetails({
          projectId,
          migrationPath,
          revision,
          files: files.slice(0, MAX_PREVIEW_FILES),
        })
      : undefined
  );
}

async function resolveAtlasDeclaredPreview(
  projectId: string,
  migrationPath: string,
  revision: string,
  includeFileDetails: boolean
): Promise<DeclaredMigrationPreview> {
  const files = await withTimeout(
    fetchMigrationFilesFromRepoPath(projectId, migrationPath, revision),
    '读取 Atlas 迁移目录'
  );

  const sqlFiles = files.filter((file) => file.name.endsWith('.sql'));
  return buildDeclaredPreview(
    'Atlas 目录',
    sqlFiles.map((file) => file.name),
    null,
    includeFileDetails
      ? sqlFiles.map((file) => ({ path: file.name, content: file.content }))
      : undefined
  );
}

async function resolveDeclaredPreviewForRun(
  run: MigrationFilePreviewRunLike,
  includeFileDetails: boolean
): Promise<DeclaredMigrationPreview | null> {
  const tool = asSupportedMigrationTool(run.specification?.tool);
  const migrationPath = resolvePath(run);
  if (!tool || !migrationPath) {
    return null;
  }

  const revision = resolveRevision(run);
  if (tool === 'sql') {
    return resolveSqlDeclaredPreview(run.projectId, migrationPath, revision, includeFileDetails);
  }
  if (tool === 'atlas') {
    return resolveAtlasDeclaredPreview(run.projectId, migrationPath, revision, includeFileDetails);
  }
  if (tool === 'drizzle') {
    return resolveDrizzleDeclaredPreview(run, revision, includeFileDetails);
  }
  if (tool === 'prisma') {
    return resolvePrismaDeclaredPreview(run.projectId, migrationPath, revision, includeFileDetails);
  }

  return resolveGenericDeclaredPreview(run.projectId, migrationPath, revision, includeFileDetails);
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

  return {
    mode: 'unknown',
    warning: '当前迁移工具暂不支持读取实时执行状态。',
  };
}

async function resolveRuntimeExecutionState(
  run: MigrationFilePreviewRunLike,
  tool: SupportedMigrationTool,
  includeFileDetails: boolean
): Promise<ExecutionStateSnapshot> {
  if (tool === 'drizzle') {
    const databaseTarget = {
      type: run.database?.type ?? 'redis',
      connectionString: normalizeRefValue(run.database?.connectionString),
      host: null,
      port: null,
      databaseName: null,
      username: null,
      password: null,
      capabilities: run.database?.capabilities ?? null,
    };

    if (!isAtlasDatabaseTarget(databaseTarget)) {
      return {
        mode: 'unknown',
        warning: '当前仅支持 PostgreSQL / MySQL 的 desired schema 预览。',
      };
    }

    if (!databaseTarget.connectionString) {
      return {
        mode: 'unknown',
        warning: '数据库连接串缺失，无法读取 desired schema 执行状态。',
      };
    }

    const revision = resolveRevision(run);

    try {
      const desiredSchema = await exportDesiredSchemaFromRepository({
        projectId: run.projectId,
        source: 'drizzle',
        revision,
        sourceConfigPath: run.specification?.sourceConfigPath ?? null,
        connectionString: databaseTarget.connectionString,
      });

      try {
        const diff = await diffDatabaseSchemaAgainstDesiredSchema({
          database: databaseTarget,
          desiredSchemaUrl: desiredSchema.schemaFileUrl,
        });

        return {
          mode: 'desired_schema',
          desiredSchemaAligned: !diff.hasChanges,
          desiredSchemaPlan:
            diff.hasChanges && diff.diffSql.trim()
              ? {
                  path: 'atlas-schema-diff.sql',
                  content: diff.diffSql,
                  language: 'sql',
                }
              : null,
          desiredSchemaPlanDetail:
            includeFileDetails && diff.hasChanges
              ? buildFilePreviewDetail('atlas-schema-diff.sql', diff.diffSql)
              : null,
          desiredSchemaDetail: includeFileDetails
            ? buildFilePreviewDetail('desired-schema.sql', desiredSchema.schemaSql)
            : null,
          warning: null,
        };
      } finally {
        await desiredSchema.cleanup();
      }
    } catch (error) {
      return {
        mode: 'unknown',
        warning:
          error instanceof PreviewTimeoutError
            ? `${error.operation}超时，已降级为仅显示 desired schema。`
            : error instanceof Error
              ? error.message
              : String(error),
      };
    }
  }

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
  includeHistoryDetails?: boolean;
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
      includeHistoryDetails: input.includeHistoryDetails,
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
      includeHistoryDetails: input.includeHistoryDetails,
    });
  }

  if (input.executionState.mode === 'desired_schema') {
    const planDetail = input.executionState.desiredSchemaPlanDetail;
    const desiredSchemaDetail = input.executionState.desiredSchemaDetail;
    const declaredPreview = planDetail
      ? {
          sourceLabel: 'Atlas schema diff',
          declaredFiles: [planDetail.path],
          declaredFileDetails: new Map([[planDetail.path, planDetail]]),
          warning: input.declaredPreview.warning,
        }
      : desiredSchemaDetail
        ? {
            ...input.declaredPreview,
            declaredFileDetails: new Map([[desiredSchemaDetail.path, desiredSchemaDetail]]),
          }
        : input.declaredPreview;
    const pending = input.executionState.desiredSchemaAligned ? [] : declaredPreview.declaredFiles;

    return buildPendingSnapshot({
      declaredPreview,
      pendingFiles: pending,
      executedTotal: input.executionState.desiredSchemaAligned
        ? declaredPreview.declaredFiles.length
        : 0,
      warning: input.executionState.warning,
      includeHistoryDetails:
        input.includeHistoryDetails || Boolean(desiredSchemaDetail) || Boolean(planDetail),
      executionPlan: input.executionState.desiredSchemaPlan,
    });
  }

  return buildPendingSnapshot({
    declaredPreview: input.declaredPreview,
    pendingFiles: declaredFiles,
    executedTotal: 0,
    warning: input.executionState.warning,
    includeHistoryDetails: input.includeHistoryDetails,
  });
}

async function resolveDeclaredPreviewWithCache(input: {
  run: MigrationFilePreviewRunLike;
  tool: SupportedMigrationTool;
  migrationPath: string;
  revision: string;
  forceRefresh: boolean;
  includeFileDetails: boolean;
}): Promise<DeclaredMigrationPreview | null> {
  const cacheKey = createDeclaredPreviewCacheKey({
    projectId: input.run.projectId,
    tool: input.tool,
    migrationPath: input.migrationPath,
    revision: input.revision,
    includeFileDetails: input.includeFileDetails,
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
      return await resolveDeclaredPreviewForRun(input.run, input.includeFileDetails);
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
  const executionStateMode = options.executionStateMode ?? 'live';
  const includeFileDetails = options.includeFileDetails ?? false;
  const needsPlatformExecutedNames =
    executionStateMode === 'live' &&
    runs.some((run) => asSupportedMigrationTool(run.specification?.tool) === 'sql');

  const databaseIds = Array.from(
    new Set(
      runs
        .map((run) => normalizeRefValue(run.database?.id))
        .filter((databaseId): databaseId is string => Boolean(databaseId))
    )
  );
  const platformExecutedByDatabase = needsPlatformExecutedNames
    ? await loadPlatformExecutedNamesByDatabase(databaseIds)
    : new Map<string, Set<string>>();

  for (const run of runs) {
    const tool = asSupportedMigrationTool(run.specification?.tool);
    const migrationPath = resolvePath(run);
    const revision = resolveRevision(run);
    if (!tool || !migrationPath) {
      continue;
    }
    const storedPreview =
      executionStateMode === 'run_status'
        ? normalizeStoredMigrationFilePreviewSnapshot(run.filePreview)
        : null;
    const shouldRehydrateStoredPreview = storedPreview
      ? shouldRehydrateStoredDesiredSchemaPreview({
          executionStateMode,
          includeFileDetails,
          run,
          storedPreview,
          tool,
        })
      : false;

    if (storedPreview && !shouldRehydrateStoredPreview) {
      previewByRunId.set(run.id, buildRunStatusPreviewFromStoredSnapshot({ run, storedPreview }));
      continue;
    }

    const isHistoricalRun =
      executionStateMode === 'run_status' && (run.status === 'success' || run.status === 'skipped');
    const includeDetailsForRun =
      includeFileDetails && (tool !== 'drizzle' || shouldRehydrateStoredPreview);
    const includeHistoryDetails =
      includeFileDetails && executionStateMode === 'run_status' && isHistoricalRun;

    const cacheKey = createDeclaredPreviewCacheKey({
      projectId: run.projectId,
      tool,
      migrationPath,
      revision,
      includeFileDetails: includeDetailsForRun,
    });

    let declaredPreview = localDeclaredPreview.get(cacheKey);
    if (declaredPreview === undefined) {
      declaredPreview = await resolveDeclaredPreviewWithCache({
        run,
        tool,
        migrationPath,
        revision,
        forceRefresh,
        includeFileDetails: includeDetailsForRun,
      });
      localDeclaredPreview.set(cacheKey, declaredPreview);
    }

    if (!declaredPreview) {
      continue;
    }

    if (executionStateMode === 'run_status') {
      const preview = applyExecutionState({
        declaredPreview,
        executionState: resolveRunStatusExecutionState({ run, declaredPreview }) ?? {
          mode: 'unknown',
        },
        includeHistoryDetails,
      });
      previewByRunId.set(run.id, preview);

      if (shouldRehydrateStoredPreview && (preview.historyFileDetails?.length ?? 0) > 0) {
        await persistMigrationRunFilePreview(run.id, preview).catch(() => undefined);
      }
      continue;
    }

    if (executionStateMode === 'declared_only') {
      previewByRunId.set(
        run.id,
        applyExecutionState({
          declaredPreview,
          executionState: {
            mode: 'unknown',
          },
          includeHistoryDetails,
        })
      );
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
          includeHistoryDetails,
        })
      );
      continue;
    }

    const runtimeKey = `${databaseId}:${cacheKey}:${includeFileDetails ? 'details' : 'names'}`;
    let executionState = runtimeExecutionStateByKey.get(runtimeKey);
    if (!executionState) {
      executionState = await resolveRuntimeExecutionState(run, tool, includeFileDetails);
      runtimeExecutionStateByKey.set(runtimeKey, executionState);
    }

    previewByRunId.set(
      run.id,
      applyExecutionState({
        declaredPreview,
        executionState,
        includeHistoryDetails,
      })
    );
  }

  return previewByRunId;
}

export async function inspectResolvedMigrationSpecPendingState(
  spec: ResolvedMigrationSpec,
  options: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    forceRefresh?: boolean;
    includeFileDetails?: boolean;
  } = {}
): Promise<MigrationPendingInspection> {
  const syntheticRunId = [
    'preview',
    spec.specification.id,
    spec.environment.id,
    spec.database.id,
    options.sourceCommitSha ?? options.sourceRef ?? spec.environment.branch ?? 'main',
  ].join(':');

  const previewByRunId = await buildMigrationFilePreviewByRunId(
    [
      {
        id: syntheticRunId,
        projectId: spec.specification.projectId,
        specification: {
          tool: spec.specification.tool,
          migrationPath: spec.specification.migrationPath,
          sourceConfigPath: spec.specification.sourceConfigPath,
        },
        database: {
          id: spec.database.id,
          type: spec.database.type,
          connectionString: spec.database.connectionString,
          capabilities: spec.database.capabilities,
        },
        release: {
          sourceRef: options.sourceRef ?? null,
          sourceCommitSha: options.sourceCommitSha ?? null,
        },
        environment: {
          branch: spec.environment.branch ?? null,
        },
      },
    ],
    {
      forceRefresh: options.forceRefresh ?? false,
      includeFileDetails: options.includeFileDetails ?? false,
    }
  );

  const preview = previewByRunId.get(syntheticRunId) ?? null;
  return {
    state: resolveMigrationPendingState(preview),
    preview,
  };
}

export async function persistMigrationRunFilePreview(
  runId: string,
  preview: MigrationFilePreviewSnapshot | null
): Promise<void> {
  await db
    .update(migrationRuns)
    .set({
      filePreview: preview,
      updatedAt: new Date(),
    })
    .where(eq(migrationRuns.id, runId));
}
