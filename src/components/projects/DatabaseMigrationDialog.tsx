'use client';

import { AlertTriangle, Database, Loader2, Play, RefreshCw, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';

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
  sqlFiles: Array<{
    name: string;
  }>;
}

interface DatabaseMigrationDialogProps {
  projectId: string;
  databaseId: string;
  databaseName: string;
  databaseType: string;
  latestImageUrl?: string | null;
  latestStatus?: string | null;
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
    none: '无锁',
    advisory: '建议锁',
    postgres_advisory: 'Postgres 建议锁',
  };

  return labels[value] ?? value;
}

export function DatabaseMigrationDialog({
  projectId,
  databaseId,
  databaseName,
  databaseType,
  latestImageUrl,
  latestStatus,
}: DatabaseMigrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [databaseId, projectId]);

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
    const interval = setInterval(() => {
      loadRuns();
    }, 3000);
    return () => clearInterval(interval);
  }, [open, loadRuns]);

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
  const confirmationMatches = plan ? confirmationText.trim() === plan.confirmationValue : false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs">
          <Database className="h-3 w-3" />
          手动执行
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{databaseName} 手动迁移控制台</DialogTitle>
          <DialogDescription>
            自动迁移应通过 release 执行。这里仅用于人工审批、重试或紧急手动执行。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="overflow-hidden rounded-[20px] border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <div className="text-sm font-semibold">手动执行计划</div>
                <div className="text-xs text-muted-foreground">
                  平台仍会校验 runner、镜像、锁策略和确认文本。
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{plan.environment.name}</Badge>
                    <Badge variant="outline">{plan.service.name}</Badge>
                    <Badge variant="outline">{plan.specification.tool}</Badge>
                    <Badge variant="outline">{plan.specification.phase}</Badge>
                    {plan.environment.isProduction && <Badge variant="destructive">生产环境</Badge>}
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
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">锁策略</div>
                      <div className="font-medium">
                        {formatLockStrategyLabel(plan.specification.lockStrategy)}
                      </div>
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

                  {(plan.warnings.length > 0 || plan.blockingReason || plan.filePreviewError) && (
                    <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        执行前确认
                      </div>
                      {plan.warnings.map((warning) => (
                        <div key={warning} className="text-xs text-muted-foreground">
                          {warning}
                        </div>
                      ))}
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
                onClick={() => {
                  loadRuns();
                  loadPlan();
                }}
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
                        <Badge variant={statusTone[run.status] ?? 'outline'}>{run.status}</Badge>
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

        <DialogFooter>
          <Button
            className="rounded-xl px-4"
            onClick={handleRun}
            disabled={triggering || planning || !plan || !plan.canRun || !confirmationMatches}
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Queue manual migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
