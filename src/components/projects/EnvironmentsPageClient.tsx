'use client';

import { ArrowRight, GitBranch, Globe, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EnvironmentSectionNav } from '@/components/projects/RuntimeSectionNav';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPreviewEnvironment,
  type DatabaseSchemaRepairPlan,
  type DeliveryRoutingRuleInput,
  deletePreviewEnvironment,
  fetchProjectEnvironments,
  type PromotionFlowInput,
  updateEnvironmentStrategy,
} from '@/lib/environments/client-actions';
import { cn } from '@/lib/utils';

interface ActivityStatusDecoration {
  color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  pulse: boolean;
  label: string;
}

interface EnvironmentActivityItem {
  key: string;
  kind: 'release' | 'deployment' | 'migration' | 'governance';
  kindLabel: string;
  title: string;
  summary: string;
  createdAtLabel: string | null;
  href: string | null;
  actionLabel: string | null;
  statusDecoration: ActivityStatusDecoration | null;
}

interface DeliveryControlEnvironmentOption {
  id: string;
  name: string;
  kind?: 'production' | 'persistent' | 'preview' | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  scopeLabel: string | null;
  sourceLabel: string | null;
}

interface DeliveryControlRuleRecord {
  id: string;
  kind: DeliveryRoutingRuleInput['kind'];
  pattern: string | null;
  priority: number;
  isActive: boolean;
  autoCreateEnvironment: boolean;
  environmentId: string | null;
  environmentName: string | null;
}

interface DeliveryControlFlowRecord {
  id: string;
  requiresApproval: boolean;
  strategy: PromotionFlowInput['strategy'];
  isActive: boolean;
  sourceEnvironmentId: string | null;
  targetEnvironmentId: string | null;
  sourceEnvironmentName: string | null;
  targetEnvironmentName: string | null;
}

interface DeliveryControlState {
  editable: boolean;
  editSummary: string;
  environments: DeliveryControlEnvironmentOption[];
  routingRules: DeliveryControlRuleRecord[];
  promotionFlows: DeliveryControlFlowRecord[];
}

interface EnvironmentRecord {
  id: string;
  name: string;
  kind?: 'production' | 'persistent' | 'preview' | null;
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
  databases: Array<{
    id: string;
    name: string;
    type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
    status: string | null;
    sourceDatabaseId: string | null;
    sourceEnvironmentName: string | null;
    isInherited: boolean;
    usageLabel: string;
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
  }>;
  databaseBindingSummary: {
    directCount: number;
    effectiveCount: number;
    inheritedCount: number;
  };
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
    statusDecoration: ActivityStatusDecoration;
  } | null;
  gitTracking: {
    state: 'pending' | 'synced';
    releaseId: string | null;
    trackingBranchName: string;
    expectsPromotionTag: boolean;
    releaseTagName: string | null;
    sourceRef: string | null;
    commitSha: string | null;
    shortCommitSha: string | null;
    syncedAtLabel: string | null;
    summary: string;
  } | null;
  recentActivity: EnvironmentActivityItem[];
  cleanupState: {
    state: 'active' | 'expired_ready' | 'expired_blocked';
    label: string;
    summary: string;
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
      <DialogContent
        size="workspace"
        className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
      >
        <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
          <DialogTitle>新建预览环境</DialogTitle>
          <DialogDescription>基于分支或 PR 直接启动。</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              {disabledSummary && (
                <div className="ui-control-muted rounded-[20px] px-4 py-3 text-sm text-muted-foreground">
                  {disabledSummary}
                </div>
              )}

              <div className="ui-control-muted rounded-[24px] p-4 sm:p-5">
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
                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                      onValueChange={(value: 'inherit' | 'isolated_clone') =>
                        setDatabaseStrategy(value)
                      }
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
                  </div>
                </div>
                {databaseStrategy === 'isolated_clone' && isolatedCloneSummary ? (
                  <div className="mt-3 text-xs text-muted-foreground">{isolatedCloneSummary}</div>
                ) : null}
              </div>

              {error && (
                <div className="ui-control rounded-[20px] bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading || disabled}>
              {loading ? '启动中...' : '启动预览环境'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getEnvironmentPriority(environment: EnvironmentRecord): number {
  switch (environment.kind) {
    case 'production':
      return 0;
    case 'persistent':
      return 1;
    case 'preview':
      return 2;
    default:
      if (environment.isProduction) {
        return 0;
      }

      return environment.isPreview ? 2 : 1;
  }
}

function buildEnvironmentHeaderMeta(environment: EnvironmentRecord): string {
  return [
    [environment.scopeLabel, environment.sourceLabel].filter(Boolean).join(' · ') || null,
    environment.expiryLabel,
  ]
    .filter(Boolean)
    .join(' · ');
}

function buildEnvironmentStatusSummary(environment: EnvironmentRecord): string {
  if (environment.policy.primarySignal?.summary) {
    return environment.policy.primarySignal.summary;
  }

  if (environment.previewLifecycle?.summary) {
    return environment.previewLifecycle.summary;
  }

  if (environment.platformSignals.primarySummary) {
    return environment.platformSignals.primarySummary;
  }

  if (environment.cleanupState?.summary) {
    return environment.cleanupState.summary;
  }

  if (environment.namespace) {
    return '运行正常，可以继续发布、查看数据或排查日志。';
  }

  return '环境已创建，相关状态会在这里持续更新。';
}

function buildEnvironmentListSummary(environment: EnvironmentRecord): string {
  if (environment.primaryDomainUrl) {
    return environment.primaryDomainUrl.replace(/^https?:\/\//, '');
  }

  return buildEnvironmentStatusSummary(environment);
}

function EnvironmentListCard({
  projectId,
  environment,
  deleteAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  deleteAction?: React.ReactNode;
}) {
  const meta = buildEnvironmentHeaderMeta(environment);
  const statusBadges = [
    environment.policy.primarySignal?.label ?? null,
    environment.previewLifecycle?.stateLabel ?? null,
  ].filter(Boolean);
  const summary = buildEnvironmentListSummary(environment);

  return (
    <div className="console-surface rounded-[24px] p-4 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                environment.isPreview
                  ? 'bg-info'
                  : environment.namespace
                    ? 'bg-success'
                    : 'bg-warning'
              )}
            />
            <span className="text-sm font-semibold capitalize">{environment.name}</span>
            {statusBadges.map((label) => (
              <Badge key={label} variant="outline" className="rounded-full px-2.5 py-0.5">
                {label}
              </Badge>
            ))}
          </div>

          {meta ? (
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {meta}
            </div>
          ) : null}

          <div
            className={cn(
              'text-foreground',
              environment.primaryDomainUrl
                ? 'truncate text-xl font-semibold tracking-tight'
                : 'text-sm leading-6'
            )}
          >
            {summary}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button asChild variant="outline" size="sm" className="h-9 rounded-full px-4">
            <Link href={`/projects/${projectId}/environments/${environment.id}`}>
              进入环境
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {deleteAction}
        </div>
      </div>
    </div>
  );
}

function EnvironmentOverviewPanel({
  environment,
  savingStrategy,
  onStrategyChange,
}: {
  environment: EnvironmentRecord;
  savingStrategy: boolean;
  onStrategyChange: (
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => void;
}) {
  const statusBadges = [
    environment.policy.primarySignal?.label ?? null,
    environment.previewLifecycle?.stateLabel ?? null,
  ].filter(Boolean);
  const hasStrategyControl = environment.actions.canConfigureStrategy;
  const strategyHelper = hasStrategyControl
    ? environment.actions.configureStrategySummary
    : environment.actions.configureStrategySummary !== environment.strategyLabel
      ? environment.actions.configureStrategySummary
      : null;

  return (
    <div className="console-surface rounded-[28px] p-4 sm:p-5">
      <div className="space-y-4">
        {environment.primaryDomainUrl ? (
          <div className="console-card rounded-[24px] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  访问地址
                </div>
                <a
                  href={environment.primaryDomainUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80"
                >
                  {environment.primaryDomainUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
              <Button asChild size="sm" className="h-10 shrink-0 rounded-full px-5">
                <a href={environment.primaryDomainUrl} target="_blank" rel="noreferrer">
                  打开地址
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            'grid gap-4',
            hasStrategyControl || strategyHelper ? 'lg:grid-cols-[1.15fr_0.85fr]' : undefined
          )}
        >
          <div className="console-card rounded-[24px] px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                当前状态
              </div>
              {statusBadges.map((label) => (
                <Badge key={label} variant="outline" className="rounded-full px-2.5 py-0.5">
                  {label}
                </Badge>
              ))}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {environment.policy.primarySignal?.label ??
                environment.previewLifecycle?.stateLabel ??
                '运行中'}
            </div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {buildEnvironmentStatusSummary(environment)}
            </div>
          </div>

          {hasStrategyControl || strategyHelper ? (
            <div className="console-card rounded-[24px] px-5 py-4 text-sm text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    发布策略
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    {environment.strategyLabel ?? '未设置'}
                  </div>
                </div>
                {savingStrategy ? (
                  <div className="text-xs text-muted-foreground">保存中...</div>
                ) : null}
              </div>
              {hasStrategyControl ? (
                <div className="mt-4">
                  <Select
                    value={environment.deploymentStrategy ?? 'rolling'}
                    onValueChange={(value: 'rolling' | 'controlled' | 'canary' | 'blue_green') =>
                      onStrategyChange(value)
                    }
                    disabled={savingStrategy}
                  >
                    <SelectTrigger className="h-11 max-w-sm rounded-2xl">
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
              ) : null}
              {strategyHelper ? (
                <div className="mt-3 text-xs leading-5 text-muted-foreground">{strategyHelper}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EnvironmentExpandedContent({
  environment,
  savingStrategy,
  onStrategyChange,
}: {
  environment: EnvironmentRecord;
  savingStrategy: boolean;
  onStrategyChange: (
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => void;
}) {
  return (
    <EnvironmentOverviewPanel
      environment={environment}
      savingStrategy={savingStrategy}
      onStrategyChange={onStrategyChange}
    />
  );
}

interface EnvironmentsPageClientProps {
  projectId: string;
  initialEnvId?: string | null;
  focusMode?: boolean;
  initialCreateOpen?: boolean;
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
      cleanupPreviews: {
        allowed: boolean;
        summary: string;
        eligibleCount: number;
        blockedCount: number;
        expiredCount: number;
      };
      recentEvents: Array<{
        key: string;
        label: string;
        summary: string;
        createdAtLabel: string | null;
      }>;
    };
    deliveryControl: DeliveryControlState;
    environments: EnvironmentRecord[];
  };
}

export function EnvironmentsPageClient({
  projectId,
  initialEnvId,
  focusMode = false,
  initialCreateOpen = false,
  initialData,
}: EnvironmentsPageClientProps) {
  const [environments, setEnvironments] = useState(initialData.environments);
  const [governance, setGovernance] = useState(initialData.governance);
  const [dialogOpen, setDialogOpen] = useState(initialCreateOpen);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingStrategyId, setSavingStrategyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialCreateOpen) {
      setDialogOpen(true);
    }
  }, [initialCreateOpen]);

  const fetchEnvironments = useCallback(async () => {
    try {
      const data =
        await fetchProjectEnvironments<EnvironmentsPageClientProps['initialData']>(projectId);
      setEnvironments(data.environments);
      setGovernance(data.governance);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载环境失败';
      setFeedback(message);
      setTimeout(() => setFeedback(null), 5000);
    }
  }, [projectId]);

  const standardEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => environment.kind !== 'preview' && !environment.isPreview)
        .sort((left, right) => {
          const leftPriority = getEnvironmentPriority(left);
          const rightPriority = getEnvironmentPriority(right);

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }

          return left.name.localeCompare(right.name);
        }),
    [environments]
  );
  const previewEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => environment.kind === 'preview' || environment.isPreview)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [environments]
  );
  const focusedEnvironment =
    (initialEnvId ? environments.find((environment) => environment.id === initialEnvId) : null) ??
    null;
  const focusedEnvironmentMeta = focusedEnvironment
    ? buildEnvironmentHeaderMeta(focusedEnvironment)
    : undefined;

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
    if (branch && prNumber) {
      setDialogError('分支和 PR 号一次只能填写一个。');
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
      setFeedback(
        data.launchState === 'building'
          ? `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在构建，完成后会自动部署`
          : `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在部署`
      );
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
        title={focusMode && focusedEnvironment ? focusedEnvironment.name : '环境'}
        description={focusMode ? focusedEnvironmentMeta : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {focusMode && focusedEnvironment ? (
              <Button asChild variant="outline" className="h-10 rounded-full px-5">
                <Link href={`/projects/${projectId}/environments`}>返回环境列表</Link>
              </Button>
            ) : null}
            {!focusMode ? (
              <Button
                className="h-10 rounded-full px-5"
                onClick={() => setDialogOpen(true)}
                disabled={!governance.createPreview.allowed}
              >
                <Plus className="h-4 w-4" />
                启动预览环境
              </Button>
            ) : null}
          </div>
        }
      />

      {focusMode ? (
        <EnvironmentSectionNav projectId={projectId} environmentId={focusedEnvironment?.id} />
      ) : null}

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
        <div className="ui-control-muted rounded-[20px] px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      {environments.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="还没有环境"
          action={{
            label: '启动预览环境',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="space-y-6">
          {focusMode && focusedEnvironment ? (
            <EnvironmentExpandedContent
              environment={focusedEnvironment}
              savingStrategy={savingStrategyId === focusedEnvironment.id}
              onStrategyChange={(value) => handleStrategyChange(focusedEnvironment.id, value)}
            />
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Globe className="h-4 w-4" />
                    核心环境
                  </div>
                  {standardEnvironments.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {standardEnvironments.length} 个
                    </div>
                  ) : null}
                </div>
                {standardEnvironments.length === 0 ? (
                  <div className="ui-control-muted rounded-[20px] px-5 py-8 text-sm text-muted-foreground">
                    暂无环境
                  </div>
                ) : (
                  <div className="space-y-3">
                    {standardEnvironments.map((environment) => (
                      <EnvironmentListCard
                        key={environment.id}
                        projectId={projectId}
                        environment={environment}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="h-4 w-4" />
                    预览环境
                  </div>
                  {previewEnvironments.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {previewEnvironments.length} 个
                    </div>
                  ) : null}
                </div>

                {previewEnvironments.length === 0 ? (
                  <EmptyState title="暂无预览环境" className="min-h-40 rounded-[20px]" />
                ) : (
                  <div className="space-y-3">
                    {previewEnvironments.map((environment) => (
                      <EnvironmentListCard
                        key={environment.id}
                        projectId={projectId}
                        environment={environment}
                        deleteAction={
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-full px-4"
                                disabled={
                                  deletingId === environment.id || !environment.actions?.canDelete
                                }
                                title={environment.actions?.deleteSummary}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {environment.cleanupState?.state === 'expired_ready'
                                  ? '立即回收'
                                  : '结束环境'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>结束预览环境？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="font-medium text-foreground">
                                    {environment.name}
                                  </span>{' '}
                                  及关联资源会一起删除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="ui-control-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                                {environment.cleanupState?.state === 'expired_ready'
                                  ? '已过期，可直接回收。'
                                  : '会回收域名、变量、数据库和运行资源。'}
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="w-full sm:w-auto">
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePreview(environment.id)}
                                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                                  disabled={
                                    deletingId === environment.id || !environment.actions?.canDelete
                                  }
                                >
                                  {deletingId === environment.id ? '处理中...' : '确认结束'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
