'use client';

import { Database, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
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

function isSuggestionRequired(kind: DatabaseSchemaRepairPlan['kind'] | null | undefined): boolean {
  return kind === 'repair_pr_required' || kind === 'adopt_current_db';
}

function getSuggestionStatusLabel(repairPlan: DatabaseSchemaRepairPlan): string {
  if (repairPlan.kind === 'manual_investigation') {
    return repairPlan.reviewUrl ? '已转排查 PR' : '待人工排查';
  }

  if (!isSuggestionRequired(repairPlan.kind)) {
    return '无需处理';
  }

  switch (repairPlan.atlasExecutionStatus) {
    case 'queued':
    case 'running':
      return '处理中';
    case 'succeeded':
      return repairPlan.reviewUrl ? '已创建修复' : '已生成';
    case 'failed':
      return '失败';
    default:
      return '待处理';
  }
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

function getSuggestionSummary(
  repairPlan: DatabaseSchemaRepairPlan | null,
  latestAtlasRun: SchemaCenterDatabaseRecord['latestAtlasRun']
): string | null {
  if (!repairPlan) {
    return null;
  }

  if (!isSuggestionRequired(repairPlan.kind)) {
    return repairPlan.summary;
  }

  switch (repairPlan.atlasExecutionStatus) {
    case 'queued':
      return '排队中';
    case 'running':
      return '生成中';
    case 'succeeded':
      return latestAtlasRun?.diffSummary ? '已生成' : '等待确认';
    case 'failed':
      return repairPlan.errorMessage ?? '执行失败';
    default:
      return '待处理';
  }
}

export function SchemaCenterClient({
  projectId,
  initialData,
}: {
  projectId: string;
  initialData: SchemaCenterData;
}) {
  const [data, setData] = useState(initialData);
  const [pendingAction, setPendingAction] = useState<{
    databaseId: string;
    action: SchemaCenterActionKey;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchProjectSchemaCenter<SchemaCenterData>(projectId);
    setData(next);
  }, [projectId]);

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
      setFeedback(successMessage);
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '执行失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setPendingAction(null);
    }
  };

  const generateSuggestion = async (databaseId: string) => {
    const plan = await createDatabaseRepairPlan(projectId, databaseId);

    if (isSuggestionRequired(plan.kind)) {
      await runDatabaseRepairAtlas(projectId, databaseId);
    }

    return plan;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={`/projects/${projectId}/runtime`}>运行</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={`/projects/${projectId}/delivery`}>交付</Link>
            </Button>
          </div>
        }
      />

      {feedback ? (
        <div className="ui-control-muted rounded-2xl px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      ) : null}

      <div className="ui-control-muted px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{data.summary.databaseCount} 个数据库</span>
          <span>{data.summary.blockingCount} 个门禁阻塞</span>
          <span>{data.summary.pendingCount} 个待迁移</span>
          <span className="ml-auto">{data.roleLabel}</span>
        </div>
      </div>

      <div className="space-y-4">
        {data.environments.map((environment) => (
          <section key={environment.id} className="ui-floating px-4 py-4">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-4 w-4" />
              <div className="text-sm font-semibold">{environment.name}</div>
              {environment.isProduction ? <Badge variant="outline">生产</Badge> : null}
              {environment.isPreview ? <Badge variant="outline">预览</Badge> : null}
            </div>

            <div className="space-y-3">
              {environment.databases.map((database) => {
                const state = database.schemaState;
                const repairPlan = database.latestRepairPlan;
                const latestAtlasRun = database.latestAtlasRun;
                const suggestionSummary = getSuggestionSummary(repairPlan, latestAtlasRun);
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
                  ((isSuggestionRequired(repairPlan.kind) &&
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
                  <div key={database.id} className="ui-control-muted rounded-2xl px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-foreground">{database.name}</div>
                          <Badge variant="secondary">{database.type}</Badge>
                          <Badge
                            variant="outline"
                            className={getSchemaStateBadgeClass(state?.status)}
                          >
                            {state?.statusLabel ?? '未纳管'}
                          </Badge>
                          {repairPlan ? (
                            <Badge variant="outline">{getSuggestionStatusLabel(repairPlan)}</Badge>
                          ) : null}
                          {repairPlan?.reviewUrl ? (
                            <Badge variant="outline">已创建 PR</Badge>
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
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
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
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
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
                            className="rounded-xl"
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
                            className="rounded-xl"
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
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
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
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <a href={repairPlan.reviewUrl} target="_blank" rel="noreferrer">
                              打开修复 PR
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {repairPlan && suggestionSummary ? (
                      <div className="ui-control mt-4 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">处理</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {repairPlan.summary}
                        </div>
                        <div className="ui-control-muted mt-2 rounded-2xl px-3 py-2 text-sm text-foreground">
                          {suggestionSummary}
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
                      <div className="ui-control-muted mt-4 rounded-2xl px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">迁移详情</Badge>
                          <Badge variant="outline">
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
                                className="ui-control rounded-2xl px-4 py-3"
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
                      <details className="ui-control-muted mt-4 rounded-2xl px-4 py-3">
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
