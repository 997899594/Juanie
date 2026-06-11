import { isSchemaManagedDatabaseType } from '@/lib/databases/platform-support';
import type { EnvironmentSchemaStateStatus } from '@/lib/db/schema';
import type { EnvironmentKindLike } from '@/lib/environments/model';
import {
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-safety/presentation';
import { formatPlatformDateTime, formatPlatformRelativeTime } from '@/lib/time/format';

export type SchemaAttentionStatus = EnvironmentSchemaStateStatus | 'missing';

export const schemaAttentionStatuses = [
  'pending_migrations',
  'aligned_untracked',
  'drifted',
  'unmanaged',
  'blocked',
  'missing',
] as const satisfies readonly SchemaAttentionStatus[];

export interface SchemaAttentionDatabaseLike {
  id: string;
  projectId: string;
  environmentId?: string | null;
  name: string;
  type: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  project: {
    id: string;
    name: string;
  };
  environment?:
    | (EnvironmentKindLike & {
        id: string;
        name: string;
        branch?: string | null;
        previewPrNumber?: number | null;
        expiresAt?: Date | string | null;
        deliveryMode?: 'direct' | 'promote_only' | null;
      })
    | null;
  service?: {
    name?: string | null;
  } | null;
  schemaState?: {
    status: EnvironmentSchemaStateStatus;
    summary?: string | null;
    expectedVersion?: string | null;
    actualVersion?: string | null;
    hasLedger?: boolean | null;
    hasUserTables?: boolean | null;
    lastInspectedAt?: Date | string | null;
    lastErrorMessage?: string | null;
    updatedAt?: Date | string | null;
  } | null;
}

export interface SchemaAttentionItem {
  id: string;
  databaseId: string;
  projectId: string;
  environmentId: string | null;
  status: SchemaAttentionStatus;
  statusLabel: string;
  statusColor: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  tone: 'danger' | 'neutral';
  projectName: string;
  environmentName: string;
  databaseName: string;
  databaseType: string;
  serviceName: string | null;
  summary: string;
  actionLabel: string;
  href: string;
  meta: string;
  versionSummary: string | null;
  lastInspectedAtLabel: string;
  updatedAtMs: number;
}

function resolveSchemaAttentionStatus(
  database: SchemaAttentionDatabaseLike
): SchemaAttentionStatus | null {
  if (!isSchemaManagedDatabaseType(database.type)) {
    return null;
  }

  const status = database.schemaState?.status ?? 'missing';
  if (status === 'aligned') {
    return null;
  }

  return schemaAttentionStatuses.includes(status) ? status : null;
}

function getSchemaAttentionStatusColor(
  status: SchemaAttentionStatus
): SchemaAttentionItem['statusColor'] {
  switch (status) {
    case 'pending_migrations':
      return 'warning';
    case 'blocked':
    case 'drifted':
    case 'unmanaged':
      return 'error';
    case 'aligned_untracked':
    case 'missing':
      return 'warning';
    default:
      return 'neutral';
  }
}

function getSchemaAttentionTone(status: SchemaAttentionStatus): SchemaAttentionItem['tone'] {
  return status === 'pending_migrations' ? 'neutral' : 'danger';
}

function getSchemaAttentionSummary(database: SchemaAttentionDatabaseLike): string {
  const status = resolveSchemaAttentionStatus(database);
  const state = database.schemaState;

  if (state?.lastErrorMessage) {
    return state.lastErrorMessage;
  }

  if (state?.summary) {
    return state.summary;
  }

  switch (status) {
    case 'pending_migrations':
      return '数据库落后于仓库声明；创建或提升下一次发布时会执行对应迁移。';
    case 'aligned_untracked':
      return '数据库结构已接近期望状态，但迁移账本缺失，需要确认后补齐账本。';
    case 'drifted':
      return '数据库实际结构偏离仓库声明，需要先确认差异来源。';
    case 'unmanaged':
      return '数据库已有结构但还没有进入平台 schema 管理链路。';
    case 'blocked':
      return '最近一次 schema 检查失败，需要打开数据库中心查看失败原因。';
    case 'missing':
      return '数据库还没有可用的 schema 检查记录，需要先检查或纳管。';
    default:
      return '数据库状态需要进一步确认。';
  }
}

function getSchemaAttentionActionLabel(status: SchemaAttentionStatus): string {
  switch (status) {
    case 'pending_migrations':
      return '去发布';
    case 'blocked':
      return '查看检查失败';
    case 'drifted':
      return '查看漂移详情';
    case 'aligned_untracked':
      return '查看账本状态';
    case 'unmanaged':
    case 'missing':
      return '打开数据库中心';
    default:
      return '打开数据库中心';
  }
}

function getSchemaStateLabel(status: SchemaAttentionStatus): string {
  return status === 'missing' ? '待检查' : getEnvironmentSchemaStateLabel(status);
}

function getVersionSummary(database: SchemaAttentionDatabaseLike): string | null {
  const versions = [
    database.schemaState?.actualVersion ? `实际 ${database.schemaState.actualVersion}` : null,
    database.schemaState?.expectedVersion ? `期望 ${database.schemaState.expectedVersion}` : null,
  ].filter(Boolean);

  return versions.length > 0 ? versions.join(' · ') : null;
}

function getUpdatedAtMs(database: SchemaAttentionDatabaseLike): number {
  const candidate =
    database.schemaState?.updatedAt ??
    database.schemaState?.lastInspectedAt ??
    database.updatedAt ??
    database.createdAt;
  const timestamp = candidate ? new Date(candidate).getTime() : Number.NEGATIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function isSchemaAttentionDatabase(database: SchemaAttentionDatabaseLike): boolean {
  return resolveSchemaAttentionStatus(database) !== null;
}

export function decorateSchemaAttentionDatabases<TDatabase extends SchemaAttentionDatabaseLike>(
  databases: TDatabase[]
): SchemaAttentionItem[] {
  return databases
    .map((database) => {
      const status = resolveSchemaAttentionStatus(database);
      if (!status) {
        return null;
      }

      const environment = database.environment ?? null;
      const environmentScope = environment ? getEnvironmentScopeLabel(environment) : null;
      const environmentSource = environment ? getEnvironmentSourceLabel(environment) : null;
      const lastInspectedAtLabel =
        formatPlatformRelativeTime(database.schemaState?.lastInspectedAt) ??
        formatPlatformDateTime(database.schemaState?.lastInspectedAt, { includeSeconds: true }) ??
        '未检查';
      const meta = [
        database.project.name,
        environment?.name ?? '未绑定环境',
        environmentScope,
        environmentSource,
        database.service?.name ?? null,
        `检查 ${lastInspectedAtLabel}`,
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        id: `schema:${database.id}`,
        databaseId: database.id,
        projectId: database.projectId,
        environmentId: database.environment?.id ?? database.environmentId ?? null,
        status,
        statusLabel: getSchemaStateLabel(status),
        statusColor: getSchemaAttentionStatusColor(status),
        tone: getSchemaAttentionTone(status),
        projectName: database.project.name,
        environmentName: environment?.name ?? '未绑定环境',
        databaseName: database.name,
        databaseType: database.type,
        serviceName: database.service?.name ?? null,
        summary: getSchemaAttentionSummary(database),
        actionLabel: getSchemaAttentionActionLabel(status),
        href: database.environment?.id
          ? `/projects/${database.projectId}/environments/${database.environment.id}/schema`
          : `/projects/${database.projectId}`,
        meta,
        versionSummary: getVersionSummary(database),
        lastInspectedAtLabel,
        updatedAtMs: getUpdatedAtMs(database),
      } satisfies SchemaAttentionItem;
    })
    .filter((item): item is SchemaAttentionItem => item !== null)
    .sort((left, right) => {
      const toneDelta = Number(right.tone === 'danger') - Number(left.tone === 'danger');
      if (toneDelta !== 0) {
        return toneDelta;
      }

      return right.updatedAtMs - left.updatedAtMs;
    });
}
