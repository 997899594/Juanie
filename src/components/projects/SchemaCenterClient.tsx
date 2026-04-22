'use client';

import { Database, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
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
import { fetchProjectSchemaCenter } from '@/lib/schema-management/client-actions';
import {
  getSchemaRepairPlanPresentation,
  isSchemaRepairSuggestionRequired,
} from '@/lib/schema-management/presentation';
import { buildSchemaRepairRealtimeStateIndex } from '@/lib/schema-management/realtime';

interface SchemaCenterDatabaseRecord {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  status: string | null;
  sourceDatabaseId: string | null;
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
}

type SchemaCenterActionKey =
  | 'inspect'
  | 'markAligned'
  | 'generateSuggestion'
  | 'confirm'
  | 'discard';

type SchemaCenterSchemaStateStatus = NonNullable<
  SchemaCenterDatabaseRecord['schemaState']
>['status'];

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

const shellClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';

const subCardClassName =
  'rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

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
  const focusedEnvironment =
    (initialEnvId
      ? data.environments.find((environment) => environment.id === initialEnvId)
      : null) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`${focusedEnvironment?.name ?? '环境'} · 数据`}
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
      />

      <div className={shellClassName}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              数据库
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {data.summary.databaseCount}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              阻塞
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {data.summary.blockingCount}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              待迁移
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {data.summary.pendingCount}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              当前权限
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{data.roleLabel}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {data.environments.map((environment) => (
          <section key={environment.id} className={shellClassName}>
            {!focusedEnvironment ? (
              <div className="mb-5 flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold text-foreground">{environment.name}</div>
                {environment.isProduction ? <Badge variant="secondary">生产</Badge> : null}
                {environment.isPreview ? <Badge variant="secondary">预览</Badge> : null}
              </div>
            ) : null}

            <div className="space-y-3">
              {environment.databases.map((database) => {
                const state = database.schemaState;
                const repairPlan = database.latestRepairPlan;
                const latestAtlasRun = database.latestAtlasRun;
                const repairPresentation = repairPlan
                  ? getSchemaRepairPlanPresentation(repairPlan, {
                      hasGeneratedDiff: Boolean(latestAtlasRun?.diffSummary),
                    })
                  : null;
                const hasPendingAction = pendingAction !== null;
                const versionSummary =
                  state?.actualVersion || state?.expectedVersion
                    ? [
                        state?.actualVersion ? `实际 ${state.actualVersion}` : null,
                        state?.expectedVersion ? `期望 ${state.expectedVersion}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : null;
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

                return (
                  <div key={database.id} className={subCardClassName}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-foreground">{database.name}</div>
                          <Badge variant="secondary">{database.type}</Badge>
                          <Badge
                            variant="secondary"
                            className={getSchemaStateBadgeClass(state?.status)}
                          >
                            {state?.statusLabel ?? '未纳管'}
                          </Badge>
                          {repairPlan ? (
                            <Badge variant="secondary">
                              {repairPresentation?.badgeLabel ?? '处理中'}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {state?.summary ?? '未纳管'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            database.status ? `运行 ${database.status}` : null,
                            state ? (state.hasLedger ? '有账本' : '无账本') : null,
                            versionSummary,
                            formatTimestamp(state?.lastInspectedAt)
                              ? `上次检查 ${formatTimestamp(state?.lastInspectedAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
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
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          检查
                        </Button>

                        {state?.status === 'aligned_untracked' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
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
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            标记对齐
                          </Button>
                        ) : null}

                        {canGenerateSuggestion ? (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
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
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            生成
                          </Button>
                        ) : null}

                        {canConfirmRepair ? (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
                            onClick={() =>
                              runAction(
                                database.id,
                                'confirm',
                                () => createDatabaseRepairReviewRequest(projectId, database.id),
                                repairPlan?.kind === 'manual_investigation'
                                  ? '已创建排查 PR'
                                  : '已创建修复 PR'
                              )
                            }
                          >
                            {isPendingAction(database.id, 'confirm') ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {repairPlan?.kind === 'manual_investigation'
                              ? '创建排查 PR'
                              : '创建修复 PR'}
                          </Button>
                        ) : null}

                        {canDiscardSuggestion ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
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
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            丢弃
                          </Button>
                        ) : null}

                        {repairPlan?.reviewUrl ? (
                          <Button asChild variant="ghost" size="sm" className="rounded-full px-3">
                            <a href={repairPlan.reviewUrl} target="_blank" rel="noreferrer">
                              打开修复 PR
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {repairPlan && repairPresentation?.summary ? (
                      <div className="mt-4 rounded-[16px] bg-white/70 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">处理建议</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {repairPlan.summary}
                        </div>
                        <div className="mt-2 rounded-[14px] bg-[rgba(243,240,233,0.64)] px-3 py-2 text-sm text-foreground">
                          {repairPresentation.summary}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {[
                            repairPlan.riskLevel ? `风险 ${repairPlan.riskLevel}` : null,
                            repairPlan.atlasExecutionFinishedAt
                              ? `完成于 ${formatTimestamp(repairPlan.atlasExecutionFinishedAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    ) : null}

                    {latestAtlasRun?.diffSummary ? (
                      <div className="mt-4 rounded-[16px] bg-white/70 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">迁移详情</Badge>
                          <Badge variant="secondary">
                            {latestAtlasRun.diffSummary.changedFiles.length} 个文件
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {latestAtlasRun.diffSummary.fileStats.map((item) => (
                            <div key={`${database.id}-schema-center-diff-${item.file}`}>
                              {item.file} · +{item.added} / -{item.removed}
                            </div>
                          ))}
                        </div>

                        {latestAtlasRun.artifactFiles ? (
                          <div className="mt-4 space-y-3">
                            {Object.entries(latestAtlasRun.artifactFiles).map(([file, content]) => (
                              <div
                                key={`${database.id}-schema-center-artifact-${file}`}
                                className="rounded-[14px] bg-[rgba(243,240,233,0.58)] px-4 py-3"
                              >
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  {file}
                                </div>
                                <pre className="mt-3 overflow-x-auto text-xs text-foreground">
                                  {content}
                                </pre>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {latestAtlasRun?.log ? (
                      <details className="mt-4 rounded-[16px] bg-white/70 px-4 py-3">
                        <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                          执行日志
                        </summary>
                        <pre className="mt-3 overflow-x-auto text-xs text-muted-foreground">
                          {latestAtlasRun.log}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
