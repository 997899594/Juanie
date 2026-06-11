'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  FileCode2,
  GitPullRequest,
  History,
  Loader2,
  Search,
  SquareTerminal,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EnvironmentPageFrame } from '@/components/projects/EnvironmentPageFrame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useSchemaRepairs } from '@/hooks/useSchemaRepairs';
import {
  createDatabaseRepairPlan,
  createDatabaseRepairReviewRequest,
  type DatabaseSchemaRepairPlan,
  discardDatabaseRepairPlan,
  inspectDatabaseSchemaState,
  markDatabaseSchemaAligned,
  runDatabaseRepairAtlas,
} from '@/lib/environments/client-actions';
import { fetchProjectSchemaCenter } from '@/lib/schema-safety/client-actions';
import {
  getSchemaRepairPlanPresentation,
  isSchemaRepairSuggestionRequired,
} from '@/lib/schema-safety/presentation';
import { buildSchemaRepairRealtimeStateIndex } from '@/lib/schema-safety/realtime';
import { cn } from '@/lib/utils';

interface SchemaCenterDatabaseRecord {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  status: string | null;
  sourceDatabaseId: string | null;
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

interface SchemaCenterEnvironmentRecord {
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

interface SchemaCenterData {
  projectName: string;
  roleLabel: string;
  selectedEnvId?: string | null;
  environments: SchemaCenterEnvironmentRecord[];
  summary: {
    databaseCount: number;
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

type SchemaCenterActionKey =
  | 'inspect'
  | 'markAligned'
  | 'generateSuggestion'
  | 'confirm'
  | 'discard'
  | 'console';

interface DatabaseConsoleOpenResponse {
  url: string;
}

interface ErrorResponse {
  error?: string;
}

type SchemaCenterSchemaStateStatus = NonNullable<
  SchemaCenterDatabaseRecord['schemaState']
>['status'];

type SchemaCenterAtlasRunStatus = NonNullable<
  SchemaCenterDatabaseRecord['latestAtlasRun']
>['status'];

interface SchemaCenterDatabaseViewModel {
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
  canGenerateSuggestion: boolean;
  canConfirmRepair: boolean;
  canDiscardSuggestion: boolean;
  hasManualAction: boolean;
}

function getSchemaStateBadgeClass(
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

function getSchemaStateIndicatorStatus(
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

function getAtlasRunStatusLabel(status: SchemaCenterAtlasRunStatus | null | undefined): string {
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

function getAtlasRunStatusClass(status: SchemaCenterAtlasRunStatus | null | undefined): string {
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

function getRiskLevelLabel(value: DatabaseSchemaRepairPlan['riskLevel'] | null | undefined) {
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

function getRiskLevelClass(value: DatabaseSchemaRepairPlan['riskLevel'] | null | undefined) {
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

function createDatabaseViewModel(
  database: SchemaCenterDatabaseRecord
): SchemaCenterDatabaseViewModel {
  const state = database.schemaState;
  const repairPlan = database.latestRepairPlan;
  const latestAtlasRun = database.latestAtlasRun;
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
    canGenerateSuggestion,
    canConfirmRepair,
    canDiscardSuggestion,
    hasManualAction,
  };
}

function formatTimestamp(value: string | Date | null | undefined): string | null {
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

const shellClassName = 'console-panel px-5 py-5';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : '请求失败';
    throw new Error(message);
  }

  return payload as T;
}

function DatabaseQuickStat({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'neutral' | 'warning' | 'error';
}) {
  return (
    <div className="console-inset px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            'text-muted-foreground',
            tone === 'warning' && 'text-warning',
            tone === 'error' && 'text-destructive'
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DatabaseActionBar({
  projectId,
  environment,
  view,
  hasPendingAction,
  isPendingAction,
  openDatabaseConsole,
  runAction,
  generateSuggestion,
}: {
  projectId: string;
  environment: SchemaCenterEnvironmentRecord;
  view: SchemaCenterDatabaseViewModel;
  hasPendingAction: boolean;
  isPendingAction: (databaseId: string, action: SchemaCenterActionKey) => boolean;
  openDatabaseConsole: (databaseId: string) => void;
  runAction: (
    databaseId: string,
    action: SchemaCenterActionKey,
    task: () => Promise<unknown>,
    successMessage: string
  ) => void;
  generateSuggestion: (databaseId: string) => Promise<DatabaseSchemaRepairPlan>;
}) {
  const { database, state, repairPlan } = view;
  const actionsDisabled = hasPendingAction || !environment.actions.canConfigureStrategy;

  return (
    <div className="flex flex-wrap gap-2">
      {database.console ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={hasPendingAction}
          onClick={() => openDatabaseConsole(database.id)}
        >
          {isPendingAction(database.id, 'console') ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          控制台
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        disabled={actionsDisabled}
        onClick={() =>
          runAction(
            database.id,
            'inspect',
            () => inspectDatabaseSchemaState(projectId, database.id),
            '已更新'
          )
        }
      >
        {isPendingAction(database.id, 'inspect') ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
        检查
      </Button>

      {state?.status === 'aligned_untracked' ? (
        <Button
          variant="default"
          size="sm"
          disabled={actionsDisabled}
          onClick={() =>
            runAction(
              database.id,
              'markAligned',
              () => markDatabaseSchemaAligned(projectId, database.id),
              '已标记对齐'
            )
          }
        >
          {isPendingAction(database.id, 'markAligned') ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          标记对齐
        </Button>
      ) : null}

      {view.canGenerateSuggestion ? (
        <Button
          variant="default"
          size="sm"
          disabled={actionsDisabled}
          onClick={() =>
            runAction(
              database.id,
              'generateSuggestion',
              () => generateSuggestion(database.id),
              '已生成'
            )
          }
        >
          {isPendingAction(database.id, 'generateSuggestion') ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileCode2 className="h-3.5 w-3.5" />
          )}
          生成迁移
        </Button>
      ) : null}

      {view.canConfirmRepair ? (
        <Button
          variant="default"
          size="sm"
          disabled={actionsDisabled}
          onClick={() =>
            runAction(
              database.id,
              'confirm',
              () => createDatabaseRepairReviewRequest(projectId, database.id),
              repairPlan?.kind === 'manual_investigation' ? '已创建排查 PR' : '已创建修复 PR'
            )
          }
        >
          {isPendingAction(database.id, 'confirm') ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <GitPullRequest className="h-3.5 w-3.5" />
          )}
          {repairPlan?.kind === 'manual_investigation' ? '创建排查 PR' : '创建修复 PR'}
        </Button>
      ) : null}

      {view.canDiscardSuggestion ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={actionsDisabled}
          onClick={() =>
            runAction(
              database.id,
              'discard',
              () => discardDatabaseRepairPlan(projectId, database.id),
              '已丢弃'
            )
          }
        >
          {isPendingAction(database.id, 'discard') ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          丢弃
        </Button>
      ) : null}

      {repairPlan?.reviewUrl ? (
        <Button asChild variant="ghost" size="sm" className="rounded-full px-3">
          <a href={repairPlan.reviewUrl} target="_blank" rel="noreferrer">
            打开 PR
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function DatabaseStatusPanel({ view }: { view: SchemaCenterDatabaseViewModel }) {
  const { database, state } = view;

  return (
    <section className="console-surface rounded-[14px] px-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 text-muted-foreground" />
        状态
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] bg-background/65 px-3 py-3">
          <div className="text-xs text-muted-foreground">表</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {database.insights.available && database.insights.tableCount !== null
              ? database.insights.tableCount
              : '—'}
          </div>
        </div>
        <div className="rounded-[14px] bg-background/65 px-3 py-3">
          <div className="text-xs text-muted-foreground">行</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {database.insights.available && database.insights.estimatedRows !== null
              ? database.insights.estimatedRows.toLocaleString('zh-CN')
              : '—'}
          </div>
        </div>
        <div className="rounded-[14px] bg-background/65 px-3 py-3">
          <div className="text-xs text-muted-foreground">账本</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {state?.hasLedger ? '有' : '—'}
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {[
          database.status ? `运行 ${database.status}` : null,
          view.versionSummary,
          view.inspectedAtLabel ? `上次检查 ${view.inspectedAtLabel}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '尚未检查。'}
      </div>
    </section>
  );
}

function DatabaseRepairPanel({ view }: { view: SchemaCenterDatabaseViewModel }) {
  const { repairPlan } = view;

  if (!repairPlan && !view.hasManualAction) {
    return (
      <section className="console-surface rounded-[14px] px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-success" />
          需要处理
        </div>
        <div className="text-sm text-muted-foreground">当前没有需要人工处理的 schema 事项。</div>
      </section>
    );
  }

  return (
    <section className="console-surface rounded-[14px] px-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-warning" />
        需要处理
      </div>
      {repairPlan ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{view.repairPresentation?.badgeLabel ?? '处理中'}</Badge>
            {getRiskLevelLabel(repairPlan.riskLevel) ? (
              <Badge variant="secondary" className={getRiskLevelClass(repairPlan.riskLevel)}>
                {getRiskLevelLabel(repairPlan.riskLevel)}
              </Badge>
            ) : null}
            {repairPlan.reviewStateLabel ? (
              <Badge variant="secondary">{repairPlan.reviewStateLabel}</Badge>
            ) : null}
          </div>
          <div className="text-sm text-foreground">{repairPlan.title}</div>
          {view.repairSummary ? (
            <div className="text-sm leading-6 text-muted-foreground">{view.repairSummary}</div>
          ) : null}
          {repairPlan.steps.length > 0 ? (
            <div className="space-y-2">
              {repairPlan.steps.map((step, index) => (
                <div key={`${repairPlan.id}-step-${step}`} className="flex gap-2 text-xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-background/80 text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm leading-6 text-muted-foreground">
          {view.primarySummary ?? '需要先检查并决定处理方式。'}
        </div>
      )}
    </section>
  );
}

function DatabaseMigrationFilesPanel({ view }: { view: SchemaCenterDatabaseViewModel }) {
  const { latestAtlasRun } = view;

  return (
    <section className="console-surface rounded-[14px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileCode2 className="h-4 w-4 text-muted-foreground" />
          迁移文件
        </div>
        {latestAtlasRun ? (
          <Badge variant="secondary" className={getAtlasRunStatusClass(latestAtlasRun.status)}>
            {getAtlasRunStatusLabel(latestAtlasRun.status)}
          </Badge>
        ) : null}
      </div>

      {view.migrationFiles.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            以下是 Atlas 为修复当前 schema 差异生成的 SQL 迁移文件，创建 PR 前应优先审阅这些内容。
          </div>
          {view.migrationFiles.map(({ file, content }) => (
            <details
              key={`${view.database.id}-migration-file-${file}`}
              className="rounded-[14px] bg-background/70"
              open={view.migrationFiles.length === 1}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-foreground">
                <span className="min-w-0 break-all font-mono">{file}</span>
                <span className="shrink-0 font-semibold text-muted-foreground">SQL</span>
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-border/70 px-3 py-3 text-xs leading-relaxed text-foreground">
                <code>{content}</code>
              </pre>
            </details>
          ))}
        </div>
      ) : view.changedFileStats.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            已检测到仓库文件变更，但当前没有可直接预览的 SQL 文件。
          </div>
          <SchemaDiffList view={view} />
        </div>
      ) : (
        <div className="rounded-[14px] bg-background/65 px-4 py-5 text-sm text-muted-foreground">
          暂无生成的迁移文件。
        </div>
      )}

      {view.supportFiles.length > 0 ? (
        <details className="group mt-3 rounded-[14px] bg-background/55 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>辅助变更 {view.supportFiles.length} 个</span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {view.supportFiles.map(({ file, content }) => (
              <div key={`${view.database.id}-support-file-${file}`}>
                <div className="break-all font-mono text-xs text-muted-foreground">{file}</div>
                <pre className="mt-2 max-h-56 overflow-auto rounded-[12px] bg-background/70 px-3 py-3 text-xs text-foreground">
                  <code>{content}</code>
                </pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SchemaDiffList({ view }: { view: SchemaCenterDatabaseViewModel }) {
  if (view.changedFileStats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {view.changedFileStats.map((item) => (
        <div
          key={`${view.database.id}-schema-center-diff-${item.file}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-background/65 px-3 py-2 text-xs"
        >
          <span className="break-all font-mono text-foreground">{item.file}</span>
          <span className="shrink-0 text-muted-foreground">
            +{item.added} / -{item.removed}
          </span>
        </div>
      ))}
    </div>
  );
}

function DatabaseRunRecordPanel({ view }: { view: SchemaCenterDatabaseViewModel }) {
  const { latestAtlasRun, repairPlan } = view;
  const log = latestAtlasRun?.log ?? repairPlan?.atlasExecutionLog ?? null;

  return (
    <section className="console-surface rounded-[14px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-muted-foreground" />
          运行记录
        </div>
        {latestAtlasRun ? (
          <Badge variant="secondary" className={getAtlasRunStatusClass(latestAtlasRun.status)}>
            {getAtlasRunStatusLabel(latestAtlasRun.status)}
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[14px] bg-background/65 px-3 py-3 text-xs">
          <div className="text-muted-foreground">开始</div>
          <div className="mt-1 text-foreground">{view.atlasRunStartedAtLabel ?? '—'}</div>
        </div>
        <div className="rounded-[14px] bg-background/65 px-3 py-3 text-xs">
          <div className="text-muted-foreground">完成</div>
          <div className="mt-1 text-foreground">{view.atlasRunFinishedAtLabel ?? '—'}</div>
        </div>
      </div>
      {latestAtlasRun?.errorMessage ? (
        <div className="mt-3 rounded-[14px] bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
          {latestAtlasRun.errorMessage}
        </div>
      ) : null}
      {log ? (
        <details className="group mt-3 rounded-[14px] bg-background/55 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <SquareTerminal className="h-3.5 w-3.5" />
              查看日志
            </span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto border-t border-border/70 px-1 py-3 text-xs leading-relaxed text-muted-foreground">
            {log}
          </pre>
        </details>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">暂无运行日志。</div>
      )}
    </section>
  );
}

function DatabaseCard({
  projectId,
  environment,
  view,
  hasPendingAction,
  isPendingAction,
  openDatabaseConsole,
  runAction,
  generateSuggestion,
}: {
  projectId: string;
  environment: SchemaCenterEnvironmentRecord;
  view: SchemaCenterDatabaseViewModel;
  hasPendingAction: boolean;
  isPendingAction: (databaseId: string, action: SchemaCenterActionKey) => boolean;
  openDatabaseConsole: (databaseId: string) => void;
  runAction: (
    databaseId: string,
    action: SchemaCenterActionKey,
    task: () => Promise<unknown>,
    successMessage: string
  ) => void;
  generateSuggestion: (databaseId: string) => Promise<DatabaseSchemaRepairPlan>;
}) {
  const { database, state, repairPlan, latestAtlasRun } = view;

  return (
    <article className="console-inset px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={getSchemaStateIndicatorStatus(state?.status)}
              pulse={latestAtlasRun?.status === 'queued' || latestAtlasRun?.status === 'running'}
              label={database.name}
            />
            <Badge variant="secondary">{database.type}</Badge>
            <Badge variant="secondary" className={getSchemaStateBadgeClass(state?.status)}>
              {state?.statusLabel ?? '未检查'}
            </Badge>
            {repairPlan ? (
              <Badge variant="secondary">{view.repairPresentation?.badgeLabel ?? '处理中'}</Badge>
            ) : null}
            {view.migrationFiles.length > 0 ? (
              <Badge variant="secondary">{view.migrationFiles.length} 个迁移文件</Badge>
            ) : null}
          </div>
          {view.primarySummary ? (
            <div className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
              {view.primarySummary}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 xl:max-w-[48%]">
          <DatabaseActionBar
            projectId={projectId}
            environment={environment}
            view={view}
            hasPendingAction={hasPendingAction}
            isPendingAction={isPendingAction}
            openDatabaseConsole={openDatabaseConsole}
            runAction={runAction}
            generateSuggestion={generateSuggestion}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <DatabaseStatusPanel view={view} />
          <DatabaseRepairPanel view={view} />
        </div>
        <div className="space-y-3">
          <DatabaseMigrationFilesPanel view={view} />
          <DatabaseRunRecordPanel view={view} />
        </div>
      </div>
    </article>
  );
}

export function SchemaCenterClient({
  projectId,
  initialData,
  initialEnvId,
}: {
  projectId: string;
  initialData: SchemaCenterData;
  initialEnvId?: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [pendingAction, setPendingAction] = useState<{
    databaseId: string;
    action: SchemaCenterActionKey;
  } | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchProjectSchemaCenter<SchemaCenterData>(
      projectId,
      initialEnvId ?? initialData.selectedEnvId ?? null
    );
    setData(next);
  }, [initialData.selectedEnvId, initialEnvId, projectId]);
  const schemaRepairStateIndex = useMemo(
    () => buildSchemaRepairRealtimeStateIndex(data.environments),
    [data.environments]
  );
  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      void refresh().catch((error) => {
        console.error('Failed to refresh schema center after realtime event:', error);
      });
    }, 120);
  }, [refresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    []
  );

  useSchemaRepairs({
    projectId,
    envId: initialEnvId ?? data.selectedEnvId ?? null,
    initialStateByDatabaseId: schemaRepairStateIndex,
    onRepair: () => {
      scheduleRealtimeRefresh();
    },
  });

  const isPendingAction = (databaseId: string, action: SchemaCenterActionKey): boolean =>
    pendingAction?.databaseId === databaseId && pendingAction?.action === action;

  const runAction = async (
    databaseId: string,
    action: SchemaCenterActionKey,
    task: () => Promise<unknown>,
    successMessage: string
  ) => {
    setPendingAction({ databaseId, action });
    try {
      await task();
      await refresh();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '执行失败');
    } finally {
      setPendingAction(null);
    }
  };

  const generateSuggestion = async (databaseId: string) => {
    const plan = await createDatabaseRepairPlan(projectId, databaseId);

    if (isSchemaRepairSuggestionRequired(plan.kind)) {
      await runDatabaseRepairAtlas(projectId, databaseId);
    }

    return plan;
  };
  const openDatabaseConsole = async (databaseId: string) => {
    setPendingAction({ databaseId, action: 'console' });
    try {
      const response = await fetch(`/api/projects/${projectId}/databases/${databaseId}/console`, {
        method: 'POST',
      });
      const result = await parseJsonResponse<DatabaseConsoleOpenResponse>(response);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '打开控制台失败');
    } finally {
      setPendingAction(null);
    }
  };
  const focusedEnvironment =
    (initialEnvId
      ? data.environments.find((environment) => environment.id === initialEnvId)
      : null) ?? null;

  return (
    <EnvironmentPageFrame
      projectId={projectId}
      environmentId={focusedEnvironment?.id}
      showEnvironmentNav={Boolean(focusedEnvironment)}
      title={`${focusedEnvironment?.name ?? '环境'} · 数据库`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {focusedEnvironment ? (
            <Button asChild variant="ghost" size="sm" className="rounded-full px-4">
              <Link href={`/projects/${projectId}/environments/${focusedEnvironment.id}`}>
                环境
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <section className={shellClassName}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold">数据库状态</div>
            <div className="mt-1 text-sm text-muted-foreground">
              共 {data.summary.databaseCount} 个数据库，{data.summary.blockingCount} 个阻塞，
              {data.summary.pendingCount} 个待迁移。
            </div>
          </div>
          <Badge variant="secondary">
            {data.databaseConsole.enabled ? `${data.databaseConsole.label} 已启用` : '控制台未启用'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <DatabaseQuickStat
            label="数据库"
            value={data.summary.databaseCount}
            icon={<Database className="h-4 w-4" />}
          />
          <DatabaseQuickStat
            label="阻塞"
            value={data.summary.blockingCount}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={data.summary.blockingCount > 0 ? 'error' : 'neutral'}
          />
          <DatabaseQuickStat
            label="待迁移"
            value={data.summary.pendingCount}
            icon={<FileCode2 className="h-4 w-4" />}
            tone={data.summary.pendingCount > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </section>

      <div className="space-y-4">
        {data.environments.map((environment) => {
          const databaseViews = environment.databases.map(createDatabaseViewModel);
          const environmentBlockingCount = databaseViews.filter((view) =>
            ['aligned_untracked', 'drifted', 'unmanaged', 'blocked'].includes(
              view.state?.status ?? 'unmanaged'
            )
          ).length;
          const environmentMigrationCount = databaseViews.reduce(
            (count, view) => count + view.migrationFiles.length,
            0
          );

          return (
            <section key={environment.id} className={shellClassName}>
              {!focusedEnvironment ? (
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-semibold text-foreground">{environment.name}</div>
                    {environment.isProduction ? <Badge variant="secondary">生产</Badge> : null}
                    {environment.isPreview ? <Badge variant="secondary">预览</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{environment.databases.length} 个数据库</Badge>
                    <Badge
                      variant="secondary"
                      className={environmentBlockingCount > 0 ? 'text-destructive' : undefined}
                    >
                      {environmentBlockingCount} 个阻塞
                    </Badge>
                    <Badge variant="secondary">{environmentMigrationCount} 个迁移文件</Badge>
                  </div>
                </div>
              ) : null}

              {databaseViews.length === 0 ? (
                <div className="console-inset px-4 py-8 text-sm text-muted-foreground">
                  当前环境没有数据库。
                </div>
              ) : (
                <div className="space-y-3">
                  {databaseViews.map((view) => (
                    <DatabaseCard
                      key={view.database.id}
                      projectId={projectId}
                      environment={environment}
                      view={view}
                      hasPendingAction={pendingAction !== null}
                      isPendingAction={isPendingAction}
                      openDatabaseConsole={openDatabaseConsole}
                      runAction={(databaseId, action, task, successMessage) => {
                        void runAction(databaseId, action, task, successMessage);
                      }}
                      generateSuggestion={generateSuggestion}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </EnvironmentPageFrame>
  );
}
