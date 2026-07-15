import { type MigrationRunStatus, migrationRunStatuses } from '@/lib/db/schema';
import type {
  MigrationFileExecutionPlan,
  MigrationFilePreviewDetail,
  MigrationFilePreviewSnapshot,
} from '@/lib/migrations/file-preview-types';

export const MAX_PREVIEW_FILES = 12;
const MAX_PREVIEW_CONTENT_BYTES = Math.max(
  Number(process.env.MIGRATION_PREVIEW_CONTENT_BYTES ?? '16384'),
  1024
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

export type MigrationPendingState = 'pending' | 'none' | 'unknown';

export interface MigrationPendingInspection {
  state: MigrationPendingState;
  preview: MigrationFilePreviewSnapshot | null;
}

export interface MigrationFilePreviewRunLike {
  id: string;
  projectId: string;
  specification?: {
    tool?: string | null;
    migrationPath?: string | null;
    sourceConfigPath?: string | null;
    targetVersion?: string | null;
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

export interface DeclaredMigrationPreview {
  sourceLabel: string;
  declaredFiles: string[];
  declaredFileDetails?: Map<string, MigrationFilePreviewDetail>;
  warning?: string | null;
}

export type SupportedMigrationTool = (typeof SUPPORTED_MIGRATION_TOOLS)[number];
export type SupportedDatabaseType = (typeof SUPPORTED_DATABASE_TYPES)[number];

export interface ExecutionStateSnapshot {
  mode: 'names' | 'versions' | 'desired_schema' | 'unknown';
  executedNames?: Set<string>;
  executedVersions?: Set<string>;
  desiredSchemaAligned?: boolean;
  desiredSchemaPlan?: MigrationFileExecutionPlan | null;
  desiredSchemaPlanDetail?: MigrationFilePreviewDetail | null;
  warning?: string | null;
}

export function asSupportedMigrationTool(value?: string | null): SupportedMigrationTool | null {
  if (!value) return null;
  return SUPPORTED_MIGRATION_TOOLS.includes(value as SupportedMigrationTool)
    ? (value as SupportedMigrationTool)
    : null;
}

export function asSupportedDatabaseType(value?: string | null): SupportedDatabaseType | null {
  if (!value) return null;
  return SUPPORTED_DATABASE_TYPES.includes(value as SupportedDatabaseType)
    ? (value as SupportedDatabaseType)
    : null;
}

export function asMigrationRunStatus(value?: string | null): MigrationRunStatus | null {
  if (!value) return null;
  return migrationRunStatuses.includes(value as MigrationRunStatus)
    ? (value as MigrationRunStatus)
    : null;
}

export function now(): number {
  return Date.now();
}

export function normalizeRefValue(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRevision(run: MigrationFilePreviewRunLike): string {
  return (
    normalizeRefValue(run.release?.sourceCommitSha) ??
    normalizeRefValue(run.release?.sourceRef) ??
    normalizeRefValue(run.environment?.branch) ??
    'main'
  );
}

export function mergeWarnings(...warnings: Array<string | null | undefined>): string | null {
  const values = warnings
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return null;
  }

  return Array.from(new Set(values)).join('；');
}

export function normalizeFileList(files: string[]): string[] {
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

export function buildDeclaredPreview(
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

export function getPreviewLanguage(pathname: string): MigrationFilePreviewDetail['language'] {
  if (pathname.endsWith('.sql')) return 'sql';
  if (pathname.endsWith('.ts')) return 'typescript';
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs') || pathname.endsWith('.cjs')) {
    return 'javascript';
  }
  return 'text';
}

export function truncatePreviewContent(content: string): { content: string; truncated: boolean } {
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

export function buildFilePreviewDetail(
  pathname: string,
  content: string
): MigrationFilePreviewDetail {
  const truncated = truncatePreviewContent(content);
  return {
    path: pathname,
    content: truncated.content,
    truncated: truncated.truncated,
    language: getPreviewLanguage(pathname),
  };
}

export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeFilePreviewDetail(value: unknown): MigrationFilePreviewDetail | null {
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

export function normalizeFilePreviewDetails(
  value: unknown
): MigrationFilePreviewDetail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const details = value
    .map((item) => normalizeFilePreviewDetail(item))
    .filter((item): item is MigrationFilePreviewDetail => Boolean(item));
  return details.length > 0 ? details : undefined;
}

export function normalizeExecutionPlan(value: unknown): MigrationFileExecutionPlan | null {
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

export function normalizeStoredMigrationFilePreviewSnapshot(
  value: unknown
): MigrationFilePreviewSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const snapshot = value as Partial<MigrationFilePreviewSnapshot>;
  if (typeof snapshot.sourceLabel !== 'string') {
    return null;
  }

  const sourceLabel = snapshot.sourceLabel;
  const isDesiredSchemaPreview = sourceLabel === 'Desired schema';

  return {
    sourceLabel,
    files: normalizeStringArray(snapshot.files),
    fileDetails: isDesiredSchemaPreview
      ? undefined
      : normalizeFilePreviewDetails(snapshot.fileDetails),

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

export function buildRunStatusPreviewFromStoredSnapshot(input: {
  run: MigrationFilePreviewRunLike;
  storedPreview: MigrationFilePreviewSnapshot;
}): MigrationFilePreviewSnapshot {
  const status = asMigrationRunStatus(input.run.status);
  if (status !== 'success' && status !== 'skipped') {
    return input.storedPreview;
  }

  const declaredTotal = Math.max(
    input.storedPreview.declaredTotal,
    input.storedPreview.executedTotal
  );
  const keepAuditableContent =
    input.storedPreview.sourceLabel !== 'Desired schema' &&
    (Boolean(input.storedPreview.executionPlan?.content?.trim()) ||
      (input.storedPreview.fileDetails?.length ?? 0) > 0 ||
      input.storedPreview.files.length > 0);

  return {
    ...input.storedPreview,
    files: keepAuditableContent ? input.storedPreview.files : [],
    fileDetails: keepAuditableContent ? input.storedPreview.fileDetails : undefined,
    executionPlan: keepAuditableContent ? input.storedPreview.executionPlan : null,
    total: 0,
    declaredTotal,
    executedTotal: declaredTotal,
  };
}

export function buildPendingSnapshot(input: {
  declaredPreview: DeclaredMigrationPreview;
  pendingFiles: string[];
  executedTotal: number;
  warning?: string | null;
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
    executionPlan: input.executionPlan ?? null,
    total: normalizedPending.length,
    declaredTotal,
    executedTotal: Math.min(Math.max(input.executedTotal, 0), declaredTotal),
    truncated: normalizedPending.length > MAX_PREVIEW_FILES,
    warning: mergeWarnings(input.declaredPreview.warning, input.warning),
  };
}

export function resolveRunStatusExecutionState(input: {
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

export function isDegradedEmptyPreview(preview: MigrationFilePreviewSnapshot): boolean {
  return (
    preview.total === 0 &&
    preview.declaredTotal === 0 &&
    preview.executedTotal === 0 &&
    Boolean(preview.warning?.trim())
  );
}
