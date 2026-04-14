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
  type DatabaseSchemaRepairReviewFlowResult,
  inspectDatabaseSchemaState,
  markDatabaseRepairPlanApplied,
  markDatabaseSchemaAligned,
  runDatabaseRepairAtlas,
  syncDatabaseRepairReviewRequest,
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
  | 'createPlan'
  | 'createReview'
  | 'syncReview'
  | 'runAtlas'
  | 'markApplied';

type SchemaCenterSchemaStateStatus = NonNullable<
  SchemaCenterDatabaseRecord['schemaState']
>['status'];

function isAutoRepairPlanKind(kind: DatabaseSchemaRepairPlan['kind'] | null | undefined): boolean {
  return kind === 'repair_pr_required' || kind === 'adopt_current_db';
}

function getRepairFlowSummary(
  repairPlan: DatabaseSchemaRepairPlan | null,
  latestAtlasRun: SchemaCenterDatabaseRecord['latestAtlasRun']
): string | null {
  if (!repairPlan || !isAutoRepairPlanKind(repairPlan.kind) || !repairPlan.reviewUrl) {
    return null;
  }

  switch (repairPlan.atlasExecutionStatus) {
    case 'queued':
      return '平台正在排队生成真实 migration，先不要去看 PR 内容。';
    case 'running':
      return '平台正在自动生成真实 migration，生成后先看下方 diff，再决定是否评审 PR。';
    case 'succeeded':
      return latestAtlasRun?.diffSummary
        ? '真实 migration 已生成。先看下方 diff 详情，再决定是否打开 PR 评审。'
        : 'Atlas 已完成，请先确认生成结果，再决定是否打开 PR。';
    case 'failed':
      return repairPlan.errorMessage ?? '自动生成 migration 失败，请重试 Atlas。';
    default:
      return '这个修复 PR 还只是中间态。先生成真实 migration 和 diff，再决定是否采用。';
  }
}

function getRepairReviewActionLabel(repairPlan: DatabaseSchemaRepairPlan): string {
  if (repairPlan.kind === 'manual_investigation') {
    return '生成排查 PR';
  }

  return '生成修复草案';
}

function getReviewLinkLabel(repairPlan: DatabaseSchemaRepairPlan): string {
  if (!isAutoRepairPlanKind(repairPlan.kind)) {
    return '打开评审单';
  }

  return repairPlan.atlasExecutionStatus === 'succeeded' ? '打开评审单' : '打开草案 PR';
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

  const repairStatusLabel: Record<DatabaseSchemaRepairPlan['status'], string> = {
    draft: '草稿',
    review_opened: '已开评审',
    applied: '已应用',
    superseded: '已替代',
    failed: '失败',
  };

  const repairReviewStateLabel: Record<DatabaseSchemaRepairPlan['reviewState'], string> = {
    draft: '草稿',
    open: '进行中',
    merged: '已合并',
    closed: '已关闭',
    unknown: '未知',
  };

  const atlasExecutionStatusLabel: Record<
    DatabaseSchemaRepairPlan['atlasExecutionStatus'],
    string
  > = {
    idle: '未执行',
    queued: '排队中',
    running: '运行中',
    succeeded: '成功',
    failed: '失败',
  };

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
    successMessage: string | ((result: unknown) => string)
  ) => {
    setPendingAction({ databaseId, action });
    try {
      const result = await task();
      await refresh();
      setFeedback(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '执行失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setPendingAction(null);
    }
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

      {feedback && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      <div className="console-surface rounded-[20px] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{data.summary.databaseCount} 个数据库</span>
          <span>{data.summary.blockingCount} 个门禁阻塞</span>
          <span>{data.summary.pendingCount} 个待迁移</span>
          <span className="ml-auto">{data.roleLabel}</span>
        </div>
      </div>

      <div className="space-y-4">
        {data.environments.map((environment) => (
          <section key={environment.id} className="console-panel px-4 py-4">
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
                const repairFlowSummary = getRepairFlowSummary(repairPlan, latestAtlasRun);
                const hasPendingAction = pendingAction !== null;
                const versionSummary =
                  state?.actualVersion || state?.expectedVersion
                    ? [
                        state?.actualVersion ? `当前 ${state.actualVersion}` : null,
                        state?.expectedVersion ? `期望 ${state.expectedVersion}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : null;

                return (
                  <div key={database.id} className="console-surface rounded-2xl px-4 py-4">
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
                            <Badge variant="outline">
                              计划 {repairStatusLabel[repairPlan.status]}
                            </Badge>
                          ) : null}
                          {repairPlan?.reviewUrl ? (
                            <Badge variant="outline">
                              评审 {repairReviewStateLabel[repairPlan.reviewState]}
                            </Badge>
                          ) : null}
                          {repairPlan ? (
                            <Badge variant="outline">
                              Atlas {atlasExecutionStatusLabel[repairPlan.atlasExecutionStatus]}
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
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
                          onClick={() =>
                            runAction(
                              database.id,
                              'inspect',
                              () => inspectDatabaseSchemaState(projectId, database.id),
                              'Schema 状态已更新'
                            )
                          }
                        >
                          {isPendingAction(database.id, 'inspect') ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          检查 schema
                        </Button>
                        {state?.status === 'aligned_untracked' && (
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
                                '数据库账本已标记为对齐'
                              )
                            }
                          >
                            {isPendingAction(database.id, 'markAligned') ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            标记为已对齐
                          </Button>
                        )}
                        {state &&
                          ['pending_migrations', 'drifted', 'unmanaged', 'blocked'].includes(
                            state.status
                          ) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={
                                hasPendingAction || !environment.actions.canConfigureStrategy
                              }
                              onClick={() =>
                                runAction(
                                  database.id,
                                  'createPlan',
                                  () => createDatabaseRepairPlan(projectId, database.id),
                                  '修复计划已生成'
                                )
                              }
                            >
                              {isPendingAction(database.id, 'createPlan') ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              生成修复计划
                            </Button>
                          )}
                        {repairPlan &&
                          [
                            'repair_pr_required',
                            'adopt_current_db',
                            'manual_investigation',
                          ].includes(repairPlan.kind) &&
                          ['draft', 'failed'].includes(repairPlan.status) && (
                            <Button
                              variant="default"
                              size="sm"
                              className="rounded-xl"
                              disabled={
                                hasPendingAction || !environment.actions.canConfigureStrategy
                              }
                              onClick={() =>
                                runAction(
                                  database.id,
                                  'createReview',
                                  () => createDatabaseRepairReviewRequest(projectId, database.id),
                                  (result) => {
                                    const flow = result as DatabaseSchemaRepairReviewFlowResult;

                                    if (flow.autoRun.status === 'failed') {
                                      return `修复 PR 已创建，但自动生成 migration 失败：${flow.autoRun.message ?? '未知错误'}`;
                                    }

                                    if (flow.autoRun.status === 'skipped') {
                                      return '排查 PR 已创建';
                                    }

                                    return '修复 PR 已创建，平台正在自动生成真实 migration';
                                  }
                                )
                              }
                            >
                              {isPendingAction(database.id, 'createReview') ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {getRepairReviewActionLabel(repairPlan)}
                            </Button>
                          )}
                        {repairPlan?.reviewUrl && (
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <a href={repairPlan.reviewUrl} target="_blank" rel="noreferrer">
                              {getReviewLinkLabel(repairPlan)}
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        {repairPlan?.reviewUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={hasPendingAction || !environment.actions.canConfigureStrategy}
                            onClick={() =>
                              runAction(
                                database.id,
                                'syncReview',
                                () => syncDatabaseRepairReviewRequest(projectId, database.id),
                                '评审状态已同步'
                              )
                            }
                          >
                            {isPendingAction(database.id, 'syncReview') ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            同步评审状态
                          </Button>
                        )}
                        {repairPlan?.status === 'review_opened' &&
                          isAutoRepairPlanKind(repairPlan.kind) &&
                          ['idle', 'failed'].includes(repairPlan.atlasExecutionStatus) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={
                                hasPendingAction || !environment.actions.canConfigureStrategy
                              }
                              onClick={() =>
                                runAction(
                                  database.id,
                                  'runAtlas',
                                  () => runDatabaseRepairAtlas(projectId, database.id),
                                  repairPlan.atlasExecutionStatus === 'failed'
                                    ? 'Atlas 已重新加入队列'
                                    : '平台正在继续自动修复'
                                )
                              }
                            >
                              {isPendingAction(database.id, 'runAtlas') ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {repairPlan.atlasExecutionStatus === 'failed'
                                ? '重试 Atlas'
                                : '继续自动修复'}
                            </Button>
                          )}
                        {repairPlan?.status === 'review_opened' &&
                          repairPlan.reviewState === 'merged' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={
                                hasPendingAction || !environment.actions.canConfigureStrategy
                              }
                              onClick={() =>
                                runAction(
                                  database.id,
                                  'markApplied',
                                  () => markDatabaseRepairPlanApplied(projectId, database.id),
                                  '修复计划已标记为应用'
                                )
                              }
                            >
                              {isPendingAction(database.id, 'markApplied') ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              标记已应用
                            </Button>
                          )}
                      </div>
                    </div>

                    {repairPlan ? (
                      <div className="mt-4 rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">
                          {repairPlan.title}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {repairPlan.summary}
                        </div>
                        {repairFlowSummary ? (
                          <div className="mt-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                            {repairFlowSummary}
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {[
                            repairPlan.nextActionLabel,
                            repairPlan.reviewStateLabel
                              ? `评审状态 ${repairPlan.reviewStateLabel}`
                              : null,
                            repairPlan.reviewSyncedAt
                              ? `同步于 ${formatTimestamp(repairPlan.reviewSyncedAt)}`
                              : null,
                            repairPlan.atlasExecutionFinishedAt
                              ? `Atlas 完成于 ${formatTimestamp(repairPlan.atlasExecutionFinishedAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {repairPlan.steps.map((step, index) => (
                            <div key={`${database.id}-schema-center-step-${index}`}>
                              {index + 1}. {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {latestAtlasRun?.diffSummary ? (
                      <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">迁移详情</Badge>
                          {latestAtlasRun.commitSha ? (
                            <Badge variant="outline">{latestAtlasRun.commitSha.slice(0, 7)}</Badge>
                          ) : null}
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
                      </div>
                    ) : null}

                    {latestAtlasRun?.log ? (
                      <pre className="mt-4 overflow-x-auto rounded-2xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
                        {latestAtlasRun.log}
                      </pre>
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
