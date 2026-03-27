'use client';

import { AlertTriangle, Database, Loader2, Play, RefreshCw, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformSignalSummary } from '@/components/ui/platform-signals';
import { Separator } from '@/components/ui/separator';
import { getDatabaseManualControlSnapshot } from '@/lib/releases/intelligence';

interface MigrationRunItem {
  id: string;
  name: string;
  status: string;
  output: string | null;
  error: string | null;
}

interface MigrationRun {
  id: string;
  status: string;
  createdAt: string;
  releaseId?: string | null;
  errorMessage: string | null;
  logExcerpt: string | null;
  specification: {
    tool: string;
    phase: string;
    command: string;
    workingDirectory: string;
    migrationPath: string | null;
    compatibility: string;
    approvalPolicy: string;
    lockStrategy: string;
  };
  service: {
    name: string;
  };
  items: MigrationRunItem[];
  sourceCommitSha?: string | null;
}

interface MigrationPlan {
  confirmationValue: string;
  canRun: boolean;
  blockingReason: string | null;
  filePreviewError: string | null;
  warnings: string[];
  commandSafety: {
    blocksExecution: boolean;
    summary: string | null;
  };
  platformSignals: {
    chips: Array<{
      key: string;
      label: string;
      tone: 'danger' | 'neutral';
    }>;
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  environmentPolicy: {
    level: 'normal' | 'protected' | 'preview';
    reasons: string[];
    summary: string | null;
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  migrationPolicy: {
    warnings: string[];
    requiresApproval: boolean;
    approvalReason: string | null;
    primarySignal: {
      code: string;
      kind: 'migration';
      level: 'warning' | 'approval_required';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  releasePolicy: {
    level: 'normal' | 'protected' | 'approval_required';
    reasons: string[];
    summary: string | null;
    requiresApproval: boolean;
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  runnerType: 'k8s_job' | 'worker';
  imageUrl: string | null;
  database: {
    id: string;
    name: string;
    type: string;
    status: string | null;
  };
  service: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
    branch: string | null;
    isProduction: boolean;
  };
  specification: {
    id: string;
    tool: string;
    phase: string;
    workingDirectory: string;
    migrationPath: string | null;
    command: string;
    compatibility: string;
    approvalPolicy: string;
    lockStrategy: string;
    autoRun: boolean;
  };
  resolution: {
    strategy: string;
    selector: {
      bindingName: string | null;
      bindingRole: string | null;
      bindingDatabaseType: string | null;
    };
  };
  envVars: string[];
  sqlFiles: Array<{
    name: string;
  }>;
}

interface MigrationDiffItem {
  key: string;
  label: string;
  current: string;
  previous: string;
}

function normalizePlanValue(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function buildPlanDiff(
  plan: MigrationPlan,
  latestRun: MigrationRun | undefined
): MigrationDiffItem[] {
  if (!latestRun) return [];

  const previousSpec = latestRun.specification;
  const currentPath = plan.specification.migrationPath ?? `migrations/${plan.database.type}`;
  const previousPath = previousSpec.migrationPath ?? `migrations/${plan.database.type}`;

  const comparisons: Array<MigrationDiffItem | null> = [
    plan.runnerType !== 'worker' || latestRun.specification.tool === 'sql'
      ? {
          key: 'command',
          label: '命令',
          current: normalizePlanValue(plan.specification.command),
          previous: normalizePlanValue(previousSpec.command),
        }
      : null,
    {
      key: 'workingDirectory',
      label: '工作目录',
      current: normalizePlanValue(plan.specification.workingDirectory),
      previous: normalizePlanValue(previousSpec.workingDirectory),
    },
    {
      key: 'migrationPath',
      label: '迁移路径',
      current: normalizePlanValue(currentPath),
      previous: normalizePlanValue(previousPath),
    },
    {
      key: 'approvalPolicy',
      label: '审批策略',
      current: formatApprovalPolicyLabel(plan.specification.approvalPolicy),
      previous: formatApprovalPolicyLabel(previousSpec.approvalPolicy),
    },
    {
      key: 'compatibility',
      label: '兼容性',
      current: formatCompatibilityLabel(plan.specification.compatibility),
      previous: formatCompatibilityLabel(previousSpec.compatibility),
    },
    {
      key: 'lockStrategy',
      label: '锁策略',
      current: formatLockStrategyLabel(plan.specification.lockStrategy),
      previous: formatLockStrategyLabel(previousSpec.lockStrategy),
    },
  ];

  return comparisons.filter(
    (item): item is MigrationDiffItem => item !== null && item.current !== item.previous
  );
}

interface DatabaseMigrationDialogProps {
  projectId: string;
  databaseId: string;
  databaseName: string;
  databaseType: string;
  disabled?: boolean;
  disabledSummary?: string | null;
  latestImageUrl?: string | null;
  latestStatus?: string | null;
  latestRelease?: {
    id: string;
    title: string;
    commitSha?: string | null;
  } | null;
  latestMigration?: {
    id: string;
    status: string;
    releaseId?: string | null;
  } | null;
}

const statusTone: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  running: 'secondary',
  queued: 'secondary',
  planning: 'secondary',
  awaiting_approval: 'outline',
  failed: 'destructive',
  canceled: 'outline',
  skipped: 'outline',
};

function formatRunStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    success: '成功',
    running: '执行中',
    queued: '排队中',
    planning: '规划中',
    awaiting_approval: '待审批',
    failed: '失败',
    canceled: '已取消',
    skipped: '已跳过',
  };

  return labels[status] ?? status;
}

function formatCompatibilityLabel(value: string): string {
  return value === 'breaking' ? '破坏性变更' : value === 'backward_compatible' ? '兼容变更' : value;
}

function formatApprovalPolicyLabel(value: string): string {
  const labels: Record<string, string> = {
    auto: '自动',
    manual: '手动',
    manual_in_production: '生产需审批',
  };

  return labels[value] ?? value;
}

function formatLockStrategyLabel(value: string): string {
  const labels: Record<string, string> = {
    platform: '平台锁',
    db_advisory: '数据库建议锁',
  };

  return labels[value] ?? value;
}

function formatResolutionStrategyLabel(value: string): string {
  const labels: Record<string, string> = {
    binding_name: '按显式绑定名解析',
    selector_match: '按逻辑选择器解析',
    service_single: '按服务唯一数据库解析',
    service_primary: '按服务主库解析',
    implicit_primary: '按主库自动解析',
    implicit_single: '按唯一候选库解析',
    unknown: '已解析',
  };

  return labels[value] ?? value;
}

export function DatabaseMigrationDialog({
  projectId,
  databaseId,
  databaseName,
  databaseType,
  disabled = false,
  disabledSummary,
  latestImageUrl,
  latestStatus,
  latestRelease,
  latestMigration,
}: DatabaseMigrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const runsSignatureRef = useRef<string>('');

  const loadRuns = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`);
        const data = await res.json();
        const nextRuns = Array.isArray(data) ? data : [];
        const nextSignature = JSON.stringify(nextRuns);
        if (nextSignature !== runsSignatureRef.current) {
          runsSignatureRef.current = nextSignature;
          setRuns(nextRuns);
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [databaseId, projectId]
  );

  useEffect(() => {
    if (!open) return;
    loadRuns();
  }, [open, loadRuns]);

  const loadPlan = useCallback(async () => {
    setPlanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          imageUrl: latestImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? '加载迁移计划失败');
        setPlan(null);
        return;
      }
      setPlan(data);
    } finally {
      setPlanning(false);
    }
  }, [databaseId, latestImageUrl, projectId]);

  useEffect(() => {
    if (!open) return;
    const hasActiveRuns = runs.some((run) =>
      ['queued', 'planning', 'running', 'awaiting_approval'].includes(run.status)
    );
    if (!hasActiveRuns) return;
    const interval = setInterval(() => {
      loadRuns({ silent: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [open, runs, loadRuns]);

  useEffect(() => {
    if (!open) {
      setPlan(null);
      setMessage(null);
      setConfirmationText('');
      return;
    }
    loadPlan();
  }, [open, loadPlan]);

  const handleRun = async () => {
    if (!plan) return;
    setTriggering(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          imageUrl: latestImageUrl,
          confirmationText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? '触发迁移失败');
        return;
      }
      setMessage(data.message ?? '迁移已加入队列');
      setConfirmationText('');
      await loadRuns();
      await loadPlan();
    } finally {
      setTriggering(false);
    }
  };

  const latestRun = runs[0];
  const diffItems = useMemo(() => (plan ? buildPlanDiff(plan, latestRun) : []), [plan, latestRun]);
  const confirmationMatches = plan ? confirmationText.trim() === plan.confirmationValue : false;
  const manualControl = getDatabaseManualControlSnapshot({
    latestMigration: latestMigration
      ? {
          status: latestMigration.status,
          releaseId: latestMigration.releaseId,
        }
      : latestRun
        ? {
            status: latestRun.status,
            releaseId: latestRun.releaseId,
          }
        : null,
    hasLatestRelease: Boolean(latestRelease),
    hasLatestImage: Boolean(latestImageUrl),
    planBlockingReason: plan?.blockingReason,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-xl text-xs"
          disabled={disabled}
          title={disabled ? (disabledSummary ?? undefined) : undefined}
        >
          <Database className="h-3 w-3" />
          对比并迁移
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
          <DialogTitle>{databaseName} 手动迁移控制台</DialogTitle>
          <DialogDescription>
            自动迁移应通过 release 执行。这里会先展示执行前对比，再决定是否手动执行。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="space-y-4">
            {disabledSummary && (
              <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                {disabledSummary}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{databaseType}</Badge>
              {latestStatus && <Badge variant="outline">数据库：{latestStatus}</Badge>}
              {latestRun && (
                <Badge variant={statusTone[latestRun.status] ?? 'outline'}>
                  最近：{formatRunStatusLabel(latestRun.status)}
                </Badge>
              )}
            </div>

            {message && <div className="text-sm text-muted-foreground">{message}</div>}

            <div className="text-sm text-muted-foreground">{manualControl.reason}</div>

            <div className="overflow-hidden rounded-[20px] border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">执行前对比</div>
                  <div className="text-xs text-muted-foreground">
                    平台会先解析目标数据库、执行器、命令和注入变量，再决定是否可执行。
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl text-xs"
                  onClick={loadPlan}
                  disabled={planning}
                >
                  <RefreshCw className="h-3 w-3" />
                  刷新计划
                </Button>
              </div>
              <div className="space-y-4 px-5 py-4">
                {planning ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载执行计划…
                  </div>
                ) : !plan ? (
                  <div className="text-sm text-muted-foreground">暂时无法获取执行计划。</div>
                ) : (
                  <>
                    <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-4 text-sm">
                      <div className="font-medium">控制面上下文</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {latestRelease ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>关联发布</span>
                            <Link
                              href={`/projects/${projectId}/releases/${latestRelease.id}`}
                              className="text-foreground underline underline-offset-4"
                            >
                              {latestRelease.title}
                            </Link>
                            {latestRelease.commitSha && (
                              <code className="rounded bg-background px-1.5 py-0.5 font-mono">
                                {latestRelease.commitSha.slice(0, 7)}
                              </code>
                            )}
                          </div>
                        ) : (
                          <div>当前没有关联 release，手动迁移会直接走控制面队列。</div>
                        )}
                        <div>
                          {plan.runnerType === 'k8s_job'
                            ? latestImageUrl
                              ? '命令式迁移会使用最近一次可用 release 镜像执行。'
                              : '命令式迁移需要最近一次可用 release 镜像；当前没有可用镜像。'
                            : '当前迁移由控制面 worker 直接执行，不依赖 release 镜像。'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{plan.environment.name}</Badge>
                      <Badge variant="outline">{plan.service.name}</Badge>
                      <Badge variant="outline">{plan.specification.tool}</Badge>
                      <Badge variant="outline">{plan.specification.phase}</Badge>
                      {plan.specification.compatibility === 'breaking' && (
                        <Badge variant="destructive">破坏性变更</Badge>
                      )}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-muted-foreground">数据库</div>
                        <div className="font-medium">{plan.database.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {plan.database.type} · {plan.database.status ?? '未知状态'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">解析方式</div>
                        <div className="font-medium">
                          {formatResolutionStrategyLabel(plan.resolution.strategy)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {plan.resolution.selector.bindingName
                            ? `名称：${plan.resolution.selector.bindingName}`
                            : plan.resolution.selector.bindingRole
                              ? `角色：${plan.resolution.selector.bindingRole}`
                              : plan.resolution.selector.bindingDatabaseType
                                ? `类型：${plan.resolution.selector.bindingDatabaseType}`
                                : '未指定，平台自动推断'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">执行器</div>
                        <div className="font-medium">{plan.runnerType}</div>
                        <div className="text-xs text-muted-foreground break-all">
                          {plan.runnerType === 'k8s_job'
                            ? (plan.imageUrl ?? '没有可用镜像')
                            : '由控制面 worker 执行'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">工作目录</div>
                        <code className="text-xs">{plan.specification.workingDirectory}</code>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">迁移路径</div>
                        <code className="text-xs">
                          {plan.specification.migrationPath ?? `migrations/${plan.database.type}`}
                        </code>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">兼容性</div>
                        <div className="font-medium">
                          {formatCompatibilityLabel(plan.specification.compatibility)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">审批策略</div>
                        <div className="font-medium">
                          {formatApprovalPolicyLabel(plan.specification.approvalPolicy)}
                        </div>
                        {(plan.migrationPolicy.primarySignal?.summary ??
                          plan.migrationPolicy.approvalReason) && (
                          <div className="text-xs text-muted-foreground">
                            {plan.migrationPolicy.primarySignal?.summary ??
                              plan.migrationPolicy.approvalReason}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">锁策略</div>
                        <div className="font-medium">
                          {formatLockStrategyLabel(plan.specification.lockStrategy)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">平台注入的数据库变量</div>
                      <div className="flex flex-wrap gap-2">
                        {plan.envVars.length > 0 ? (
                          plan.envVars.map((envVar) => (
                            <Badge key={envVar} variant="outline">
                              {envVar}
                            </Badge>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            当前没有可注入的数据库变量。
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TerminalSquare className="h-3.5 w-3.5" />
                        命令预览
                      </div>
                      <pre className="overflow-x-auto rounded-2xl border border-border bg-secondary/30 p-3 text-xs">
                        {plan.specification.command}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-foreground">
                        与最近一次运行的差异
                      </div>
                      {latestRun ? (
                        diffItems.length > 0 ? (
                          <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-3">
                            {diffItems.map((item) => (
                              <div key={item.key} className="space-y-1 text-xs">
                                <div className="font-medium text-foreground">{item.label}</div>
                                <div className="text-muted-foreground">
                                  之前：<code>{item.previous}</code>
                                </div>
                                <div className="text-foreground">
                                  现在：<code>{item.current}</code>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                            当前计划和最近一次运行没有可见差异。
                          </div>
                        )
                      ) : (
                        <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                          这是第一次手动迁移，没有可对比的历史运行。
                        </div>
                      )}
                    </div>

                    {plan.specification.tool === 'sql' && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          待执行 SQL 文件（{plan.sqlFiles.length}）
                        </div>
                        {plan.sqlFiles.length > 0 ? (
                          <div className="space-y-1 rounded-2xl border border-border bg-secondary/30 p-3">
                            {plan.sqlFiles.map((file) => (
                              <div key={file.name} className="text-xs text-muted-foreground">
                                {file.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            在当前迁移路径下没有找到 SQL 文件。
                          </div>
                        )}
                      </div>
                    )}

                    {(plan.warnings.length > 0 ||
                      plan.platformSignals.primarySummary ||
                      plan.platformSignals.nextActionLabel ||
                      plan.blockingReason ||
                      plan.filePreviewError) && (
                      <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          差异与风险提示
                        </div>
                        <PlatformSignalSummary
                          summary={plan.platformSignals.primarySummary}
                          nextActionLabel={plan.platformSignals.nextActionLabel}
                          className="border-border bg-background"
                        />
                        {plan.warnings.map((warning) => (
                          <div key={warning} className="text-xs text-muted-foreground">
                            {warning}
                          </div>
                        ))}
                        {plan.commandSafety.summary && (
                          <div className="text-xs text-destructive">
                            {plan.commandSafety.summary}
                          </div>
                        )}
                        {plan.blockingReason && (
                          <div className="text-xs text-destructive">{plan.blockingReason}</div>
                        )}
                        {plan.filePreviewError && !plan.blockingReason && (
                          <div className="text-xs text-destructive">{plan.filePreviewError}</div>
                        )}
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor={`migration-confirm-${databaseId}`}>
                        输入 <code>{plan.confirmationValue}</code> 以确认执行
                      </Label>
                      <Input
                        id={`migration-confirm-${databaseId}`}
                        value={confirmationText}
                        onChange={(event) => setConfirmationText(event.target.value)}
                        placeholder={plan.confirmationValue}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <div className="text-sm font-semibold">最近运行</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl text-xs"
                  onClick={() => loadRuns()}
                >
                  <RefreshCw className="h-3 w-3" />
                  刷新
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground">加载中…</div>
                ) : runs.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground">还没有迁移记录。</div>
                ) : (
                  <div className="divide-y divide-border/70">
                    {runs.map((run) => (
                      <div key={run.id} className="space-y-2 px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusTone[run.status] ?? 'outline'}>
                            {formatRunStatusLabel(run.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{run.service.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {run.specification.tool}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {run.errorMessage && (
                          <div className="text-xs text-destructive">{run.errorMessage}</div>
                        )}
                        {run.releaseId && (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/projects/${projectId}/releases/${run.releaseId}`}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              打开发布详情
                            </Link>
                            {(run.status === 'awaiting_approval' ||
                              run.status === 'failed' ||
                              run.status === 'canceled') && (
                              <span className="text-xs text-muted-foreground">
                                审批和重试都在发布页处理。
                              </span>
                            )}
                          </div>
                        )}
                        {run.items.length > 0 && (
                          <div className="space-y-1">
                            {run.items.map((item) => (
                              <div key={item.id} className="text-xs text-muted-foreground">
                                {item.name} · {item.status}
                              </div>
                            ))}
                          </div>
                        )}
                        {run.logExcerpt && (
                          <pre className="overflow-x-auto rounded-2xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                            {run.logExcerpt}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 bg-background px-6 py-4">
          <Button
            className="rounded-xl px-4"
            onClick={handleRun}
            disabled={
              disabled || triggering || planning || !plan || !plan.canRun || !confirmationMatches
            }
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            确认执行迁移
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
