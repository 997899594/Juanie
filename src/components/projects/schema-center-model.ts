import type { DatabaseSchemaRepairPlan } from '@/lib/environments/client-actions';
import {
  getSchemaRepairPlanPresentation,
  isSchemaRepairSuggestionRequired,
} from '@/lib/schema-safety/presentation';

export interface SchemaCenterDatabaseRecord {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  status: string | null;
  sourceDatabaseId: string | null;
  schemaManagement: {
    enabled: boolean;
  };
  insights: {
    available: boolean;
    status: 'ready' | 'unsupported' | 'not_configured' | 'unavailable';
    tableCount: number | null;
    estimatedRows: number | null;
    checkedAt: string;
  };
  schemaState: {
    status:
      | 'aligned'
      | 'pending_migrations'
      | 'aligned_untracked'
      | 'drifted'
      | 'unmanaged'
      | 'blocked';
    statusLabel: string;
    summary: string | null;
    expectedVersion: string | null;
    actualVersion: string | null;
    hasLedger: boolean;
    hasUserTables: boolean;
    lastInspectedAt: string | Date | null;
  } | null;
  latestRepairPlan: DatabaseSchemaRepairPlan | null;
  latestAtlasRun: {
    id: string;
    status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
    commitSha: string | null;
    generatedFiles: string[] | null;
    artifactFiles: Record<string, string> | null;
    diffSummary: {
      changedFiles: string[];
      fileStats: Array<{
        file: string;
        added: number;
        removed: number;
      }>;
    } | null;
    log: string | null;
    errorMessage: string | null;
    startedAt: string | Date | null;
    finishedAt: string | Date | null;
  } | null;
  console: {
    enabled: true;
    provider: 'dbgate';
    label: string;
    consoleUrl: string;
    accessModeLabel: string;
    summary: string;
    changeManagementSummary: string;
    context: {
      engine: string;
      target: string;
      namespace: string | null;
      serviceName: string | null;
      host: string | null;
      port: number | null;
      databaseName: string | null;
    };
  } | null;
}

export interface SchemaCenterEnvironmentRecord {
  id: string;
  name: string;
  isProduction: boolean | null;
  isPreview: boolean | null;
  actions: {
    canConfigureStrategy: boolean;
    configureStrategySummary: string;
  };
  databases: SchemaCenterDatabaseRecord[];
}

export interface SchemaCenterData {
  projectName: string;
  roleLabel: string;
  selectedEnvId?: string | null;
  environments: SchemaCenterEnvironmentRecord[];
  summary: {
    databaseCount: number;
    schemaManagedCount: number;
    blockingCount: number;
    pendingCount: number;
  };
  databaseConsole: {
    enabled: boolean;
    provider: 'dbgate';
    label: string;
    accessModeLabel: string;
    summary: string;
    changeManagementSummary: string;
  };
}

export type SchemaCenterActionKey =
  | 'inspect'
  | 'markAligned'
  | 'generateSuggestion'
  | 'confirm'
  | 'discard'
  | 'console';

export interface DatabaseConsoleOpenResponse {
  url: string;
}

export interface ErrorResponse {
  error?: string;
}

export type SchemaCenterSchemaStateStatus = NonNullable<
  SchemaCenterDatabaseRecord['schemaState']
>['status'];

export type SchemaCenterAtlasRunStatus = NonNullable<
  SchemaCenterDatabaseRecord['latestAtlasRun']
>['status'];

export interface SchemaCenterDatabaseViewModel {
  database: SchemaCenterDatabaseRecord;
  state: SchemaCenterDatabaseRecord['schemaState'];
  repairPlan: DatabaseSchemaRepairPlan | null;
  latestAtlasRun: SchemaCenterDatabaseRecord['latestAtlasRun'];
  repairPresentation: ReturnType<typeof getSchemaRepairPlanPresentation> | null;
  versionSummary: string | null;
  repairSummary: string | null;
  primarySummary: string | null;
  inspectedAtLabel: string | null;
  atlasRunFinishedAtLabel: string | null;
  atlasRunStartedAtLabel: string | null;
  migrationFiles: Array<{ file: string; content: string }>;
  supportFiles: Array<{ file: string; content: string }>;
  changedFileStats: Array<{ file: string; added: number; removed: number }>;
  isSchemaManaged: boolean;
  canGenerateSuggestion: boolean;
  canConfirmRepair: boolean;
  canDiscardSuggestion: boolean;
  hasManualAction: boolean;
}

export function getSchemaStateBadgeClass(
  status: SchemaCenterSchemaStateStatus | null | undefined
): string {
  switch (status) {
    case 'aligned':
      return 'border-success/40 text-success';
    case 'pending_migrations':
      return 'border-warning/40 text-warning';
    case 'aligned_untracked':
      return 'border-warning/40 text-warning';
    case 'drifted':
      return 'border-destructive/40 text-destructive';
    case 'blocked':
      return 'border-destructive/40 text-destructive';
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

export function getSchemaStateIndicatorStatus(
  status: SchemaCenterSchemaStateStatus | null | undefined
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'aligned':
      return 'success';
    case 'pending_migrations':
    case 'aligned_untracked':
      return 'warning';
    case 'drifted':
    case 'blocked':
      return 'error';
    default:
      return 'neutral';
  }
}

export function getAtlasRunStatusLabel(
  status: SchemaCenterAtlasRunStatus | null | undefined
): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'running':
      return '生成中';
    case 'succeeded':
      return '已生成';
    case 'failed':
      return '失败';
    case 'idle':
      return '未开始';
    default:
      return '未运行';
  }
}

export function getAtlasRunStatusClass(
  status: SchemaCenterAtlasRunStatus | null | undefined
): string {
  switch (status) {
    case 'succeeded':
      return 'border-success/40 text-success';
    case 'queued':
    case 'running':
      return 'border-info/40 text-info';
    case 'failed':
      return 'border-destructive/40 text-destructive';
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

export function getRiskLevelLabel(value: DatabaseSchemaRepairPlan['riskLevel'] | null | undefined) {
  switch (value) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
    default:
      return null;
  }
}

export function getRiskLevelClass(value: DatabaseSchemaRepairPlan['riskLevel'] | null | undefined) {
  switch (value) {
    case 'high':
      return 'border-destructive/40 text-destructive';
    case 'medium':
      return 'border-warning/40 text-warning';
    case 'low':
      return 'border-success/40 text-success';
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

export function createDatabaseViewModel(
  database: SchemaCenterDatabaseRecord
): SchemaCenterDatabaseViewModel {
  const isSchemaManaged = database.schemaManagement.enabled;
  const state = isSchemaManaged ? database.schemaState : null;
  const repairPlan = isSchemaManaged ? database.latestRepairPlan : null;
  const latestAtlasRun = isSchemaManaged ? database.latestAtlasRun : null;
  const repairPresentation = repairPlan
    ? getSchemaRepairPlanPresentation(repairPlan, {
        hasGeneratedDiff: Boolean(latestAtlasRun?.diffSummary),
      })
    : null;
  const versionSummary =
    state?.actualVersion || state?.expectedVersion
      ? [
          state?.actualVersion ? `实际 ${state.actualVersion}` : null,
          state?.expectedVersion ? `期望 ${state.expectedVersion}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;
  const stateSummary =
    state?.summary &&
    ['aligned_untracked', 'drifted', 'unmanaged', 'blocked'].includes(state.status)
      ? state.summary
      : null;
  const repairSummary = repairPlan
    ? (repairPlan.summary ?? repairPresentation?.summary ?? null)
    : null;
  const artifactFiles = latestAtlasRun?.artifactFiles
    ? Object.entries(latestAtlasRun.artifactFiles)
        .map(([file, content]) => ({ file, content, isSql: file.endsWith('.sql') }))
        .sort((left, right) => Number(right.isSql) - Number(left.isSql))
    : [];
  const migrationFiles = artifactFiles
    .filter((file) => file.isSql)
    .map(({ file, content }) => ({ file, content }));
  const supportFiles = artifactFiles
    .filter((file) => !file.isSql)
    .map(({ file, content }) => ({ file, content }));
  const changedFileStats =
    latestAtlasRun?.diffSummary?.fileStats ??
    latestAtlasRun?.generatedFiles?.map((file) => ({
      file,
      added: 0,
      removed: 0,
    })) ??
    [];
  const canGenerateSuggestion =
    isSchemaManaged &&
    !!state &&
    ['drifted', 'unmanaged', 'blocked'].includes(state.status) &&
    (!repairPlan || ['draft', 'failed', 'superseded'].includes(repairPlan.status));
  const canConfirmRepair =
    !!repairPlan &&
    ((isSchemaRepairSuggestionRequired(repairPlan.kind) &&
      repairPlan.status === 'draft' &&
      repairPlan.atlasExecutionStatus === 'succeeded') ||
      (repairPlan.kind === 'manual_investigation' &&
        ['draft', 'failed'].includes(repairPlan.status)));
  const canDiscardSuggestion =
    !!repairPlan &&
    repairPlan.status === 'draft' &&
    (repairPlan.kind === 'manual_investigation' ||
      repairPlan.atlasExecutionStatus === 'succeeded' ||
      repairPlan.atlasExecutionStatus === 'failed');
  const hasManualAction =
    state?.status === 'aligned_untracked' ||
    canGenerateSuggestion ||
    canConfirmRepair ||
    canDiscardSuggestion ||
    Boolean(repairPlan?.reviewUrl);
  const primarySummary =
    (!isSchemaManaged
      ? `${database.type} 是运行时资源，不参与 schema 检查、迁移预检或接管。`
      : null) ??
    stateSummary ??
    latestAtlasRun?.errorMessage ??
    repairSummary ??
    (state?.status === 'aligned' ? '数据库结构与仓库期望一致。' : null);

  return {
    database,
    state,
    repairPlan,
    latestAtlasRun,
    repairPresentation,
    versionSummary,
    repairSummary,
    primarySummary,
    inspectedAtLabel: formatTimestamp(state?.lastInspectedAt),
    atlasRunFinishedAtLabel: formatTimestamp(latestAtlasRun?.finishedAt),
    atlasRunStartedAtLabel: formatTimestamp(latestAtlasRun?.startedAt),
    migrationFiles,
    supportFiles,
    changedFileStats,
    isSchemaManaged,
    canGenerateSuggestion,
    canConfirmRepair,
    canDiscardSuggestion,
    hasManualAction,
  };
}

export function formatTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
