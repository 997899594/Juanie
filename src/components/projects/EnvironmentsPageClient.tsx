'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  GitBranch,
  Globe,
  Plus,
  Rocket,
  ScrollText,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { EnvironmentResourcePanel } from '@/components/projects/EnvironmentResourcePanel';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { PlatformSignalSummary } from '@/components/ui/platform-signals';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPreviewEnvironment,
  deletePreviewEnvironment,
  fetchProjectEnvironments,
  updateEnvironmentStrategy,
} from '@/lib/environments/client-actions';
import { cn } from '@/lib/utils';

interface EnvironmentRecord {
  id: string;
  name: string;
  namespace: string | null;
  isProduction: boolean | null;
  autoDeploy: boolean;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  branch: string | null;
  isPreview: boolean | null;
  previewPrNumber: number | null;
  expiresAt: string | Date | null;
  domains: Array<{
    id: string;
    hostname: string;
    isVerified: boolean | null;
    serviceId: string | null;
    service?: {
      id: string;
      name: string;
    } | null;
  }>;
  policy: {
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
  platformSignals: {
    chips: Array<{
      key: string;
      label: string;
      tone: 'danger' | 'neutral';
    }>;
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  scopeLabel: string | null;
  sourceLabel: string | null;
  strategyLabel: string | null;
  databaseStrategyLabel: string | null;
  inheritanceLabel: string | null;
  expiryLabel: string | null;
  expiryTimestamp: string | null;
  primaryDomainUrl: string | null;
  previewLifecycle: {
    stateLabel: string;
    summary: string | null;
    nextActionLabel: string;
  } | null;
  latestReleaseCard: {
    id: string;
    title: string;
    shortCommitSha: string | null;
    createdAtLabel: string | null;
  } | null;
  actions: {
    canConfigureStrategy: boolean;
    configureStrategySummary: string;
    canDelete?: boolean;
    deleteSummary?: string;
  };
}

const deploymentStrategyOptions = [
  { value: 'rolling', label: '滚动发布' },
  { value: 'controlled', label: '受控放量' },
  { value: 'canary', label: '金丝雀' },
  { value: 'blue_green', label: '蓝绿切换' },
] as const;

interface PreviewDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  disabledSummary?: string | null;
  allowIsolatedClone: boolean;
  isolatedCloneSummary?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    branch: string;
    prNumber: string;
    ttlHours: string;
    databaseStrategy: 'inherit' | 'isolated_clone';
  }) => Promise<void>;
}

function PreviewEnvironmentDialog({
  open,
  loading,
  error,
  disabled = false,
  disabledSummary,
  allowIsolatedClone,
  isolatedCloneSummary,
  onOpenChange,
  onSubmit,
}: PreviewDialogProps) {
  const [branch, setBranch] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [ttlHours, setTtlHours] = useState('72');
  const [databaseStrategy, setDatabaseStrategy] = useState<'inherit' | 'isolated_clone'>('inherit');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ branch, prNumber, ttlHours, databaseStrategy });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建预览环境</DialogTitle>
          <DialogDescription>
            输入分支或 PR 号。平台会创建或续期对应的预览环境，并沿用现有 release 流程发布。
          </DialogDescription>
        </DialogHeader>

        {disabledSummary && (
          <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
            {disabledSummary}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preview-branch">分支</Label>
              <Input
                id="preview-branch"
                placeholder="feature/release-intel"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                disabled={loading || disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-pr">PR 号</Label>
              <Input
                id="preview-pr"
                inputMode="numeric"
                placeholder="42"
                value={prNumber}
                onChange={(event) => setPrNumber(event.target.value)}
                disabled={loading || disabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preview-ttl">保留时长（小时）</Label>
            <Input
              id="preview-ttl"
              inputMode="numeric"
              placeholder="72"
              value={ttlHours}
              onChange={(event) => setTtlHours(event.target.value)}
              disabled={loading || disabled}
            />
          </div>

          <div className="space-y-2">
            <Label>数据库策略</Label>
            <Select
              value={databaseStrategy}
              onValueChange={(value: 'inherit' | 'isolated_clone') => setDatabaseStrategy(value)}
              disabled={loading || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择数据库策略" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">继承基础数据库</SelectItem>
                <SelectItem value="isolated_clone" disabled={!allowIsolatedClone}>
                  独立预览库
                </SelectItem>
              </SelectContent>
            </Select>
            {databaseStrategy === 'isolated_clone' && isolatedCloneSummary && (
              <div className="text-xs text-muted-foreground">{isolatedCloneSummary}</div>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || disabled}>
              {loading ? '创建中...' : '创建预览环境'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EnvironmentsPageClientProps {
  projectId: string;
  initialEnvId?: string | null;
  initialDiagnosticsEnvId?: string | null;
  initialData: {
    governance: {
      roleLabel: string;
      createPreview: {
        allowed: boolean;
        summary: string;
      };
      createIsolatedPreview: {
        allowed: boolean;
        summary: string;
      };
      deletePreview: {
        allowed: boolean;
        summary: string;
      };
      manageEnvVars: {
        allowed: boolean;
        summary: string;
      };
    };
    environments: EnvironmentRecord[];
  };
}

export function EnvironmentsPageClient({
  projectId,
  initialEnvId,
  initialDiagnosticsEnvId,
  initialData,
}: EnvironmentsPageClientProps) {
  const defaultExpandedEnvId =
    initialData.environments.find((environment) => environment.id === initialEnvId)?.id ??
    initialData.environments[0]?.id ??
    null;
  const [environments, setEnvironments] = useState(initialData.environments);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    defaultExpandedEnvId ? { [defaultExpandedEnvId]: true } : {}
  );
  const [diagnosticEnvId, setDiagnosticEnvId] = useState<string | null>(
    initialData.environments.some((environment) => environment.id === initialDiagnosticsEnvId)
      ? (initialDiagnosticsEnvId ?? null)
      : null
  );
  const [governance, setGovernance] = useState(initialData.governance);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingStrategyId, setSavingStrategyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const data =
        await fetchProjectEnvironments<EnvironmentsPageClientProps['initialData']>(projectId);
      setEnvironments(data.environments);
      setGovernance(data.governance);
      setExpanded((prev) => {
        if (Object.keys(prev).length > 0) {
          return prev;
        }

        return data.environments[0] ? { [data.environments[0].id]: true } : {};
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载环境失败';
      setFeedback(message);
      setTimeout(() => setFeedback(null), 5000);
    }
  }, [projectId]);

  const standardEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => !environment.isPreview)
        .sort((left, right) => {
          if (left.isProduction !== right.isProduction) {
            return left.isProduction ? 1 : -1;
          }

          return left.name.localeCompare(right.name);
        }),
    [environments]
  );
  const previewEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => environment.isPreview)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [environments]
  );

  const toggleExpanded = (envId: string) => {
    setExpanded((prev) => ({ ...prev, [envId]: !prev[envId] }));
  };

  const toggleDiagnostics = (envId: string) => {
    setExpanded((prev) => ({ ...prev, [envId]: true }));
    setDiagnosticEnvId((current) => (current === envId ? null : envId));
  };

  const handleCreatePreview = async (input: {
    branch: string;
    prNumber: string;
    ttlHours: string;
    databaseStrategy: 'inherit' | 'isolated_clone';
  }) => {
    setDialogLoading(true);
    setDialogError(null);

    const branch = input.branch.trim();
    const prNumber = input.prNumber.trim();
    const ttlHours = input.ttlHours.trim();

    if (!branch && !prNumber) {
      setDialogError('至少填写分支或 PR 号。');
      setDialogLoading(false);
      return;
    }

    try {
      const data = await createPreviewEnvironment({
        projectId,
        branch: branch || undefined,
        prNumber: prNumber ? Number.parseInt(prNumber, 10) : undefined,
        ttlHours: ttlHours ? Number.parseInt(ttlHours, 10) : undefined,
        databaseStrategy: input.databaseStrategy,
      });

      setDialogOpen(false);
      setFeedback(`已准备 ${data.name}`);
      setExpanded((prev) => ({ ...prev, [data.id]: true }));
      await fetchEnvironments();
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '创建预览环境失败');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeletePreview = async (environmentId: string) => {
    setDeletingId(environmentId);

    try {
      await deletePreviewEnvironment(projectId, environmentId);
      setFeedback('预览环境已删除');
      await fetchEnvironments();
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '删除预览环境失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStrategyChange = async (
    environmentId: string,
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => {
    setSavingStrategyId(environmentId);

    try {
      await updateEnvironmentStrategy({
        projectId,
        environmentId,
        deploymentStrategy,
      });
      await fetchEnvironments();
      setFeedback('发布策略已更新');
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '更新发布策略失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setSavingStrategyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="环境"
        description="先选环境，再进入对应发布、预览与配置。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/releases`}>
                <Rocket className="h-4 w-4" />
                查看发布
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/logs`}>
                <ScrollText className="h-4 w-4" />
                查看日志
              </Link>
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!governance.createPreview.allowed}
            >
              <Plus className="h-4 w-4" />
              新建预览环境
            </Button>
          </div>
        }
      />

      <PreviewEnvironmentDialog
        open={dialogOpen}
        loading={dialogLoading}
        error={dialogError}
        disabled={!governance.createPreview.allowed}
        disabledSummary={governance.createPreview.summary}
        allowIsolatedClone={governance.createIsolatedPreview.allowed}
        isolatedCloneSummary={governance.createIsolatedPreview.summary}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDialogError(null);
          }
        }}
        onSubmit={handleCreatePreview}
      />

      {feedback && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
        当前角色：{governance.roleLabel}
      </div>

      {environments.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="还没有环境"
          description="部署后会自动创建固定环境，也可以先创建预览环境。"
          action={{
            label: '新建预览环境',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4" />
              核心环境
            </div>
            {standardEnvironments.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-5 py-8 text-sm text-muted-foreground">
                还没有固定环境。
              </div>
            ) : (
              <div className="space-y-3">
                {standardEnvironments.map((environment) => {
                  const isExpanded = !!expanded[environment.id];
                  return (
                    <div key={environment.id} className="console-panel overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(environment.id)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/20"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              environment.namespace ? 'bg-success' : 'bg-warning'
                            )}
                          />
                          <span className="text-sm font-semibold capitalize">
                            {environment.name}
                          </span>
                          {environment.namespace ? (
                            <code className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono text-muted-foreground">
                              {environment.namespace}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">尚未部署</span>
                          )}
                          {environment.isProduction && <Badge>生产</Badge>}
                          {environment.autoDeploy && !environment.isProduction && (
                            <Badge variant="secondary">自动部署</Badge>
                          )}
                          {environment.latestReleaseCard && (
                            <Badge variant="outline">
                              最近发布 {environment.latestReleaseCard.shortCommitSha ?? '最新'}
                            </Badge>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/70 px-5 py-4">
                          {environment.platformSignals.primarySummary && (
                            <div className="mb-4 text-sm text-foreground">
                              {environment.platformSignals.primarySummary}
                            </div>
                          )}
                          {environment.platformSignals.nextActionLabel && (
                            <div className="mb-4 text-xs text-muted-foreground">
                              下一步：{environment.platformSignals.nextActionLabel}
                            </div>
                          )}
                          <div className="mb-4 flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm" className="rounded-xl">
                              <Link href={`/projects/${projectId}/logs?env=${environment.id}`}>
                                查看日志
                              </Link>
                            </Button>
                            {environment.latestReleaseCard && (
                              <Button asChild variant="outline" size="sm" className="rounded-xl">
                                <Link
                                  href={`/projects/${projectId}/releases/${environment.latestReleaseCard.id}`}
                                >
                                  打开发布
                                </Link>
                              </Button>
                            )}
                            <Button
                              variant={diagnosticEnvId === environment.id ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-xl"
                              onClick={() => toggleDiagnostics(environment.id)}
                            >
                              {diagnosticEnvId === environment.id ? '收起资源诊断' : '资源诊断'}
                            </Button>
                          </div>
                          <div className="mb-4 rounded-2xl border border-border bg-background px-4 py-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">发布策略</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  控制这个环境如何切换新版本。
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {environment.actions.configureStrategySummary}
                              </div>
                            </div>
                            <Select
                              value={environment.deploymentStrategy ?? 'rolling'}
                              onValueChange={(
                                value: 'rolling' | 'controlled' | 'canary' | 'blue_green'
                              ) => handleStrategyChange(environment.id, value)}
                              disabled={
                                savingStrategyId === environment.id ||
                                !environment.actions.canConfigureStrategy
                              }
                            >
                              <SelectTrigger className="max-w-sm">
                                <SelectValue placeholder="选择发布策略" />
                              </SelectTrigger>
                              <SelectContent>
                                {deploymentStrategyOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {environment.latestReleaseCard && (
                            <div className="mb-4 rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">
                                    {environment.latestReleaseCard.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {environment.latestReleaseCard.createdAtLabel ?? '最近发布'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {diagnosticEnvId === environment.id && (
                            <div className="mb-4">
                              <EnvironmentResourcePanel
                                projectId={projectId}
                                environmentId={environment.id}
                                environmentName={environment.name}
                              />
                            </div>
                          )}
                          <EnvVarManager
                            projectId={projectId}
                            environmentId={environment.id}
                            environmentName={environment.name}
                            canManage={governance.manageEnvVars.allowed}
                            disabledSummary={governance.manageEnvVars.summary}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4" />
              预览环境
            </div>

            {previewEnvironments.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-5 py-8 text-sm text-muted-foreground">
                还没有预览环境。创建后会自动接入 release 与 deployment 主链。
              </div>
            ) : (
              <div className="space-y-3">
                {previewEnvironments.map((environment) => {
                  const isExpanded = !!expanded[environment.id];

                  return (
                    <div key={environment.id} className="console-panel overflow-hidden">
                      <div className="flex items-start justify-between gap-3 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(environment.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-colors hover:text-foreground"
                        >
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-info" />
                              <span className="text-sm font-semibold">{environment.name}</span>
                              {environment.scopeLabel && (
                                <Badge variant="secondary">{environment.scopeLabel}</Badge>
                              )}
                              {environment.sourceLabel && (
                                <Badge variant="outline">{environment.sourceLabel}</Badge>
                              )}
                              {environment.expiryLabel && (
                                <Badge
                                  variant={
                                    environment.expiryLabel === '已过期' ? 'warning' : 'outline'
                                  }
                                >
                                  {environment.expiryLabel}
                                </Badge>
                              )}
                              {environment.latestReleaseCard && (
                                <Badge variant="outline">
                                  最近发布 {environment.latestReleaseCard.shortCommitSha ?? '最新'}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              {environment.namespace ? (
                                <code className="rounded-xl bg-secondary px-2.5 py-1 font-mono">
                                  {environment.namespace}
                                </code>
                              ) : (
                                <span>尚未分配命名空间</span>
                              )}
                              {environment.primaryDomainUrl && (
                                <a
                                  href={environment.primaryDomainUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  <span>
                                    {environment.primaryDomainUrl.replace('https://', '')}
                                  </span>
                                </a>
                              )}
                              {environment.expiryTimestamp && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  <span>{environment.expiryTimestamp}</span>
                                </span>
                              )}
                            </div>
                            {environment.platformSignals.primarySummary && (
                              <div className="text-xs text-muted-foreground">
                                {environment.platformSignals.primarySummary}
                              </div>
                            )}
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0"
                              disabled={
                                deletingId === environment.id || !environment.actions?.canDelete
                              }
                              title={environment.actions?.deleteSummary}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>删除预览环境？</AlertDialogTitle>
                              <AlertDialogDescription>
                                这会删除 {environment.name} 及其关联资源。若还有活跃 release，
                                平台会拒绝删除。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePreview(environment.id)}
                                disabled={
                                  deletingId === environment.id || !environment.actions?.canDelete
                                }
                              >
                                {deletingId === environment.id ? '删除中...' : '确认删除'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/70 px-5 py-4">
                          {(environment.platformSignals.primarySummary ||
                            environment.platformSignals.nextActionLabel) && (
                            <PlatformSignalSummary
                              summary={environment.platformSignals.primarySummary}
                              nextActionLabel={environment.platformSignals.nextActionLabel}
                              className="mb-4 border-border bg-background"
                            />
                          )}
                          <div className="mb-4 flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm" className="rounded-xl">
                              <Link href={`/projects/${projectId}/logs?env=${environment.id}`}>
                                查看日志
                              </Link>
                            </Button>
                            {environment.latestReleaseCard && (
                              <Button asChild variant="outline" size="sm" className="rounded-xl">
                                <Link
                                  href={`/projects/${projectId}/releases/${environment.latestReleaseCard.id}`}
                                >
                                  打开发布
                                </Link>
                              </Button>
                            )}
                            <Button
                              variant={diagnosticEnvId === environment.id ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-xl"
                              onClick={() => toggleDiagnostics(environment.id)}
                            >
                              {diagnosticEnvId === environment.id ? '收起资源诊断' : '资源诊断'}
                            </Button>
                          </div>
                          <div className="mb-4 rounded-2xl border border-border bg-background px-4 py-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">发布策略</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {environment.databaseStrategyLabel}
                                  {environment.inheritanceLabel
                                    ? ` · ${environment.inheritanceLabel}`
                                    : ''}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {environment.actions.configureStrategySummary}
                              </div>
                            </div>
                            <Select
                              value={environment.deploymentStrategy ?? 'rolling'}
                              onValueChange={(
                                value: 'rolling' | 'controlled' | 'canary' | 'blue_green'
                              ) => handleStrategyChange(environment.id, value)}
                              disabled={
                                savingStrategyId === environment.id ||
                                !environment.actions.canConfigureStrategy
                              }
                            >
                              <SelectTrigger className="max-w-sm">
                                <SelectValue placeholder="选择发布策略" />
                              </SelectTrigger>
                              <SelectContent>
                                {deploymentStrategyOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {environment.latestReleaseCard && (
                            <div className="mb-4 rounded-2xl border border-border bg-background px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">
                                    {environment.latestReleaseCard.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {environment.latestReleaseCard.createdAtLabel ?? '最近发布'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {diagnosticEnvId === environment.id && (
                            <div className="mb-4">
                              <EnvironmentResourcePanel
                                projectId={projectId}
                                environmentId={environment.id}
                                environmentName={environment.name}
                              />
                            </div>
                          )}
                          {environment.domains.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                              {environment.domains.map((domain) => (
                                <a
                                  key={domain.id}
                                  href={`https://${domain.hostname}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  <span>{domain.hostname}</span>
                                  {domain.service?.name && (
                                    <Badge variant="secondary">{domain.service.name}</Badge>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}
                          <EnvVarManager
                            projectId={projectId}
                            environmentId={environment.id}
                            environmentName={environment.name}
                            canManage={governance.manageEnvVars.allowed}
                            disabledSummary={governance.manageEnvVars.summary}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="flex items-center gap-2 rounded-[24px] border border-border bg-background/95 p-2 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={`/projects/${projectId}/releases`}>
              <Rocket className="h-4 w-4" />
              发布
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={`/projects/${projectId}/logs`}>
              <ScrollText className="h-4 w-4" />
              日志
            </Link>
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => setDialogOpen(true)}
            disabled={!governance.createPreview.allowed}
          >
            <Plus className="h-4 w-4" />
            预览
          </Button>
        </div>
      </div>
    </div>
  );
}
