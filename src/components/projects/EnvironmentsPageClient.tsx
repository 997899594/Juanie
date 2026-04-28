'use client';

import { useForm } from '@tanstack/react-form';
import { ArrowRight, GitBranch, Globe, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EnvironmentAIInfoWindow } from '@/components/projects/EnvironmentAIInfoWindow';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';
import type { EnvironmentTaskCenterSnapshot } from '@/lib/ai/tasks/environment-task-center';
import {
  setEnvironmentRuntimeState as controlEnvironmentRuntime,
  createPreviewEnvironment,
  type DatabaseSchemaRepairPlan,
  type DeliveryRoutingRuleInput,
  deletePreviewEnvironment,
  type EnvironmentRuntimeState,
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

interface EnvironmentVariableOverview {
  direct: Array<{ id: string }>;
  effective: Array<{ id: string; inherited: boolean }>;
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
  sourceBuild: {
    label: string;
    summary: string;
    nextActionLabel: string;
    tone: 'danger' | 'neutral';
    status: 'building' | 'failed';
    shortCommitSha: string | null;
    startedAtLabel: string | null;
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
  runtimeState: EnvironmentRuntimeState | null;
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
  disabled = false,
  disabledSummary,
  allowIsolatedClone,
  isolatedCloneSummary,
  onOpenChange,
  onSubmit,
}: PreviewDialogProps) {
  const form = useForm({
    defaultValues: {
      branch: '',
      prNumber: '',
      ttlHours: '72',
      databaseStrategy: 'inherit' as 'inherit' | 'isolated_clone',
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
      form.reset();
    },
  });

  const getErrorMessage = (errors: unknown[]): string | null => {
    const firstError = errors[0];

    if (typeof firstError === 'string') {
      return firstError;
    }

    if (
      typeof firstError === 'object' &&
      firstError !== null &&
      'message' in firstError &&
      typeof firstError.message === 'string'
    ) {
      return firstError.message;
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="workspace" layout="workspace">
        <DialogHeader chrome>
          <DialogTitle>新建预览环境</DialogTitle>
          <DialogDescription>基于分支或 PR 直接启动。</DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit().catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : '创建预览环境失败');
            });
          }}
        >
          <DialogBody>
            <FormSection className="space-y-4 px-0 py-0 shadow-none">
              {disabledSummary ? <FormDescription>{disabledSummary}</FormDescription> : null}

              <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(243,240,233,0.72),rgba(255,255,255,0.88))] p-4 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset,0_0_0_1px_rgba(17,17,17,0.028)] sm:p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <form.Field name="branch">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>分支</FormLabel>
                        <Input
                          id={field.name}
                          placeholder="feature/release-intel"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage>
                          {field.state.meta.isTouched
                            ? getErrorMessage(field.state.meta.errors)
                            : null}
                        </FormMessage>
                      </FormField>
                    )}
                  </form.Field>
                  <form.Field name="prNumber">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>PR 号</FormLabel>
                        <Input
                          id={field.name}
                          inputMode="numeric"
                          placeholder="42"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage>
                          {field.state.meta.isTouched
                            ? getErrorMessage(field.state.meta.errors)
                            : null}
                        </FormMessage>
                      </FormField>
                    )}
                  </form.Field>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <form.Field name="ttlHours">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor={field.name}>保留时长（小时）</FormLabel>
                        <Input
                          id={field.name}
                          inputMode="numeric"
                          placeholder="72"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={loading || disabled}
                        />
                        <FormMessage />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name="databaseStrategy">
                    {(field) => (
                      <FormField>
                        <FormLabel htmlFor="preview-database-strategy">数据库策略</FormLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(value: 'inherit' | 'isolated_clone') =>
                            field.handleChange(value)
                          }
                          disabled={loading || disabled}
                        >
                          <SelectTrigger id="preview-database-strategy">
                            <SelectValue placeholder="选择数据库策略" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">继承基础数据库</SelectItem>
                            <SelectItem value="isolated_clone" disabled={!allowIsolatedClone}>
                              独立预览库
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {field.state.value === 'isolated_clone' && isolatedCloneSummary ? (
                          <FormDescription>{isolatedCloneSummary}</FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormField>
                    )}
                  </form.Field>
                </div>
              </div>
            </FormSection>
          </DialogBody>

          <DialogFooter chrome>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <form.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
              {({ isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full rounded-full sm:w-auto"
                  disabled={loading || disabled || isSubmitting}
                >
                  {loading || isSubmitting ? '启动中...' : '启动预览环境'}
                </Button>
              )}
            </form.Subscribe>
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
  if (environment.runtimeState?.state === 'sleeping') {
    return environment.runtimeState.summary;
  }

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
    return '运行正常';
  }

  return '状态更新中';
}

function buildRuntimeStateLabel(runtimeState: EnvironmentRuntimeState | null): string {
  switch (runtimeState?.state) {
    case 'running':
      return '运行中';
    case 'sleeping':
      return '已休眠';
    case 'partial':
      return '唤醒中';
    case 'not_deployed':
      return '未部署';
    case 'unknown':
      return '未知';
    default:
      return '未连接';
  }
}

function getRuntimeAction(environment: EnvironmentRecord): 'sleep' | 'wake' | null {
  if (environment.isProduction) {
    return null;
  }

  switch (environment.runtimeState?.state) {
    case 'running':
    case 'partial':
      return 'sleep';
    case 'sleeping':
      return 'wake';
    default:
      return null;
  }
}

function buildEnvironmentListSummary(environment: EnvironmentRecord): string {
  if (environment.primaryDomainUrl) {
    return environment.primaryDomainUrl.replace(/^https?:\/\//, '');
  }

  return buildEnvironmentStatusSummary(environment);
}

function buildEnvironmentSourceSummary(environment: EnvironmentRecord): {
  label: string;
  summary: string;
} {
  if (environment.sourceBuild) {
    return {
      label: environment.sourceBuild.label,
      summary: environment.sourceBuild.summary,
    };
  }

  if (environment.gitTracking) {
    return {
      label: environment.sourceLabel ?? '来源',
      summary: environment.gitTracking.summary,
    };
  }

  if (environment.sourceLabel) {
    return {
      label: environment.sourceLabel,
      summary:
        environment.branch && !environment.sourceLabel.includes(environment.branch)
          ? `跟随 ${environment.branch}`
          : '持续更新',
    };
  }

  return {
    label: '手动环境',
    summary: '手动发布或提升',
  };
}

function buildEnvironmentVersionSummary(environment: EnvironmentRecord): {
  label: string;
  summary: string;
} {
  if (environment.sourceBuild && !environment.latestReleaseCard) {
    return {
      label: environment.sourceBuild.label,
      summary: environment.sourceBuild.nextActionLabel,
    };
  }

  if (!environment.latestReleaseCard) {
    return {
      label: '暂无版本',
      summary: '还没有版本',
    };
  }

  return {
    label: environment.latestReleaseCard.title,
    summary: [
      environment.latestReleaseCard.shortCommitSha
        ? `commit ${environment.latestReleaseCard.shortCommitSha}`
        : null,
      environment.latestReleaseCard.createdAtLabel,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

function buildEnvironmentDatabaseSummary(environment: EnvironmentRecord): string {
  const totalCount = environment.databases.length;
  if (totalCount === 0) {
    return '没有数据库';
  }

  const issueCount = environment.databases.filter((database) => {
    const status = database.schemaState?.status;
    return status === 'drifted' || status === 'blocked' || status === 'pending_migrations';
  }).length;

  const inheritedCount = environment.databaseBindingSummary.inheritedCount;

  return [
    `${totalCount} 个数据库`,
    issueCount > 0 ? `${issueCount} 个需处理` : null,
    inheritedCount > 0 ? `${inheritedCount} 个继承` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function EnvironmentListCard({
  projectId,
  environment,
  runtimeAction,
  deleteAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  runtimeAction?: ReactNode;
  deleteAction?: ReactNode;
}) {
  const meta = buildEnvironmentHeaderMeta(environment);
  const statusBadges = [
    environment.runtimeState?.state === 'sleeping' ? '已休眠' : null,
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
              <Badge key={label} variant="secondary" className="rounded-full px-2.5 py-0.5">
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
          {runtimeAction}
          <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
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
  projectId,
  environment,
  savingStrategy,
  onStrategyChange,
  initialAiSummary,
  initialMigrationReview,
  initialEnvvarRisk,
  initialTaskCenter,
  initialDynamicPluginPanels,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  savingStrategy: boolean;
  onStrategyChange: (
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => void;
  initialAiSummary?: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
  initialMigrationReview?: ResolvedAIPluginSnapshot<MigrationReview> | null;
  initialEnvvarRisk?: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
  initialTaskCenter?: EnvironmentTaskCenterSnapshot | null;
  initialDynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
  }>;
  runtimeAction?: ReactNode;
}) {
  const [variableSummary, setVariableSummary] = useState('变量状态加载中');
  const hasStrategyControl = environment.actions.canConfigureStrategy;
  const sourceSummary = buildEnvironmentSourceSummary(environment);
  const versionSummary = buildEnvironmentVersionSummary(environment);
  const schemaSummary = buildEnvironmentDatabaseSummary(environment);
  const mainFlowItems = [
    {
      key: 'source',
      label: '来源',
      value: sourceSummary.label,
      summary: sourceSummary.summary,
    },
    {
      key: 'release',
      label: '版本',
      value: versionSummary.label,
      summary: versionSummary.summary,
    },
    {
      key: 'schema',
      label: 'Schema Safety',
      value: schemaSummary,
      summary: variableSummary,
    },
    {
      key: 'runtime',
      label: '运行',
      value: buildRuntimeStateLabel(environment.runtimeState),
      summary: environment.runtimeState?.summary ?? '运行态暂不可用',
    },
  ];
  const strategyHelper = hasStrategyControl
    ? environment.actions.configureStrategySummary
    : environment.actions.configureStrategySummary !== environment.strategyLabel
      ? environment.actions.configureStrategySummary
      : null;
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';
  const titleClassName =
    'text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground';
  const valueClassName =
    'mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-foreground';
  const summaryClassName = 'mt-2 text-sm leading-6 text-muted-foreground';

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${projectId}/env-vars/overview?environmentId=${environment.id}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载变量状态失败');
        }

        return (await response.json()) as EnvironmentVariableOverview;
      })
      .then((overview) => {
        if (cancelled) {
          return;
        }

        const effectiveCount = overview.effective.length;
        const inheritedCount = overview.effective.filter((item) => item.inherited).length;
        setVariableSummary(
          [
            effectiveCount === 0 ? '没有变量' : `${effectiveCount} 个生效变量`,
            inheritedCount > 0 ? `${inheritedCount} 个继承` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        );
      })
      .catch(() => {
        if (!cancelled) {
          setVariableSummary('变量状态暂不可用');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [environment.id, projectId]);

  return (
    <div className="space-y-4">
      {environment.primaryDomainUrl ? (
        <section className={cn(shellClassName, 'px-6 py-6 sm:px-7')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className={titleClassName}>访问地址</div>
              <a
                href={environment.primaryDomainUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block truncate text-[2.35rem] font-semibold leading-none tracking-[-0.045em] text-foreground transition-colors hover:text-foreground/78 sm:text-[2.8rem]"
              >
                {environment.primaryDomainUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
            <Button asChild variant="ghost" className="h-11 shrink-0 rounded-full px-5 text-sm">
              <a href={environment.primaryDomainUrl} target="_blank" rel="noreferrer">
                打开地址
              </a>
            </Button>
          </div>
        </section>
      ) : null}

      <section className={shellClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className={titleClassName}>运行态</div>
            <div className={valueClassName}>{buildRuntimeStateLabel(environment.runtimeState)}</div>
            <div className={summaryClassName}>
              {environment.runtimeState?.summary ?? '运行态暂不可用'}
            </div>
            {environment.runtimeState?.autoSleep ? (
              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {environment.runtimeState.autoSleep.summary}
              </div>
            ) : null}
            {environment.runtimeState?.state === 'sleeping' && environment.primaryDomainUrl ? (
              <div className="mt-2 text-sm text-muted-foreground">
                访问地址会自动唤醒应用，数据库和环境变量不会被重建。
              </div>
            ) : null}
          </div>
          {runtimeAction ? <div className="shrink-0">{runtimeAction}</div> : null}
        </div>
      </section>

      <section className={cn(shellClassName, 'px-4 py-4 sm:px-5')}>
        <div className={titleClassName}>主链路</div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {mainFlowItems.map((item, index) => (
            <div
              key={item.key}
              className="relative min-w-0 rounded-[18px] bg-white/70 px-4 py-4 shadow-[0_0_0_1px_rgba(17,17,17,0.04)]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-2 truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                {item.value}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.summary || '等待数据'}
              </div>
              {index < mainFlowItems.length - 1 ? (
                <ArrowRight className="-right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/60 md:absolute md:block" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <EnvironmentAIInfoWindow
        projectId={projectId}
        environmentId={environment.id}
        initialAiSummary={initialAiSummary}
        initialMigrationReview={initialMigrationReview}
        initialEnvvarRisk={initialEnvvarRisk}
        initialTaskCenter={initialTaskCenter}
        initialDynamicPluginPanels={initialDynamicPluginPanels}
      />

      <section>
        <div
          className={cn(
            shellClassName,
            'bg-[linear-gradient(180deg,rgba(244,241,234,0.92),rgba(255,255,255,0.94))]'
          )}
        >
          <div className={titleClassName}>发布方式</div>
          <div className="mt-3 text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {environment.strategyLabel ?? '未设置'}
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
                <SelectTrigger className="h-12 rounded-[18px] bg-white/88">
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
          {savingStrategy ? (
            <div className="mt-3 text-xs text-muted-foreground">保存中...</div>
          ) : null}
          {strategyHelper || environment.strategyLabel ? (
            <div className={summaryClassName}>{strategyHelper ?? environment.strategyLabel}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EnvironmentExpandedContent({
  projectId,
  environment,
  savingStrategy,
  onStrategyChange,
  initialAiSummary,
  initialMigrationReview,
  initialEnvvarRisk,
  initialTaskCenter,
  initialDynamicPluginPanels,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  savingStrategy: boolean;
  onStrategyChange: (
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => void;
  initialAiSummary?: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
  initialMigrationReview?: ResolvedAIPluginSnapshot<MigrationReview> | null;
  initialEnvvarRisk?: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
  initialTaskCenter?: EnvironmentTaskCenterSnapshot | null;
  initialDynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
  }>;
  runtimeAction?: ReactNode;
}) {
  return (
    <EnvironmentOverviewPanel
      projectId={projectId}
      environment={environment}
      savingStrategy={savingStrategy}
      onStrategyChange={onStrategyChange}
      initialAiSummary={initialAiSummary}
      initialMigrationReview={initialMigrationReview}
      initialEnvvarRisk={initialEnvvarRisk}
      initialTaskCenter={initialTaskCenter}
      initialDynamicPluginPanels={initialDynamicPluginPanels}
      runtimeAction={runtimeAction}
    />
  );
}

interface EnvironmentsPageClientProps {
  projectId: string;
  initialEnvId?: string | null;
  focusMode?: boolean;
  initialCreateOpen?: boolean;
  initialAiSummary?: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
  initialMigrationReview?: ResolvedAIPluginSnapshot<MigrationReview> | null;
  initialEnvvarRisk?: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
  initialTaskCenter?: EnvironmentTaskCenterSnapshot | null;
  initialDynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
  }>;
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
  initialAiSummary,
  initialMigrationReview,
  initialEnvvarRisk,
  initialTaskCenter,
  initialDynamicPluginPanels,
  initialData,
}: EnvironmentsPageClientProps) {
  const [environments, setEnvironments] = useState(initialData.environments);
  const [governance, setGovernance] = useState(initialData.governance);
  const [dialogOpen, setDialogOpen] = useState(initialCreateOpen);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingStrategyId, setSavingStrategyId] = useState<string | null>(null);
  const [runtimeActionId, setRuntimeActionId] = useState<string | null>(null);

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
      toast.error(error instanceof Error ? error.message : '加载环境失败');
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

    const branch = input.branch.trim();
    const prNumber = input.prNumber.trim();
    const ttlHours = input.ttlHours.trim();

    if (!branch && !prNumber) {
      setDialogLoading(false);
      throw new Error('至少填写分支或 PR 号。');
    }
    if (branch && prNumber) {
      setDialogLoading(false);
      throw new Error('分支和 PR 号一次只能填写一个。');
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
      toast.success(
        data.launchState === 'building'
          ? `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在构建，完成后会自动部署`
          : `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在部署`
      );
      await fetchEnvironments();
    } catch (error) {
      throw error instanceof Error ? error : new Error('创建预览环境失败');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeletePreview = async (environmentId: string) => {
    setDeletingId(environmentId);

    try {
      await deletePreviewEnvironment(projectId, environmentId);
      toast.success('预览环境已删除');
      await fetchEnvironments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除预览环境失败');
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
      toast.success('发布策略已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新发布策略失败');
    } finally {
      setSavingStrategyId(null);
    }
  };

  const handleRuntimeControl = async (environment: EnvironmentRecord, action: 'sleep' | 'wake') => {
    setRuntimeActionId(environment.id);

    try {
      await controlEnvironmentRuntime({
        projectId,
        environmentId: environment.id,
        action,
      });
      toast.success(
        action === 'sleep' ? `${environment.name} 已休眠` : `${environment.name} 已唤醒`
      );
      await fetchEnvironments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '运行态操作失败');
    } finally {
      setRuntimeActionId(null);
    }
  };

  const renderRuntimeAction = (environment: EnvironmentRecord) => {
    const action = getRuntimeAction(environment);

    if (!action) {
      return null;
    }

    return (
      <Button
        type="button"
        variant={action === 'sleep' ? 'ghost' : 'default'}
        size="sm"
        className="h-9 rounded-full px-4"
        disabled={runtimeActionId === environment.id}
        onClick={() => handleRuntimeControl(environment, action)}
      >
        {runtimeActionId === environment.id ? '处理中...' : action === 'sleep' ? '休眠' : '唤醒'}
      </Button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={focusMode && focusedEnvironment ? focusedEnvironment.name : '环境'}
        description={focusMode ? focusedEnvironmentMeta : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {focusMode && focusedEnvironment ? (
              <Button asChild variant="ghost" className="h-10 rounded-full px-5">
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
        disabled={!governance.createPreview.allowed}
        disabledSummary={governance.createPreview.summary}
        allowIsolatedClone={governance.createIsolatedPreview.allowed}
        isolatedCloneSummary={governance.createIsolatedPreview.summary}
        onOpenChange={(open) => {
          setDialogOpen(open);
        }}
        onSubmit={handleCreatePreview}
      />

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
              projectId={projectId}
              environment={focusedEnvironment}
              savingStrategy={savingStrategyId === focusedEnvironment.id}
              onStrategyChange={(value) => handleStrategyChange(focusedEnvironment.id, value)}
              initialAiSummary={initialAiSummary}
              initialMigrationReview={initialMigrationReview}
              initialEnvvarRisk={initialEnvvarRisk}
              initialTaskCenter={initialTaskCenter}
              initialDynamicPluginPanels={initialDynamicPluginPanels}
              runtimeAction={renderRuntimeAction(focusedEnvironment)}
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
                  <div className="rounded-[20px] bg-[rgba(243,240,233,0.68)] px-5 py-8 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.66)_inset]">
                    暂无环境
                  </div>
                ) : (
                  <div className="space-y-3">
                    {standardEnvironments.map((environment) => (
                      <EnvironmentListCard
                        key={environment.id}
                        projectId={projectId}
                        environment={environment}
                        runtimeAction={renderRuntimeAction(environment)}
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
                        runtimeAction={renderRuntimeAction(environment)}
                        deleteAction={
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
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
                            <AlertDialogContent size="form">
                              <AlertDialogHeader>
                                <AlertDialogTitle>结束预览环境？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <span className="font-medium text-foreground">
                                    {environment.name}
                                  </span>{' '}
                                  及关联资源会一起删除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="rounded-2xl bg-[rgba(243,240,233,0.66)] px-4 py-3 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
                                {environment.cleanupState?.state === 'expired_ready'
                                  ? '已过期，可直接回收。'
                                  : '会回收域名、变量、数据库和运行资源。'}
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="w-full rounded-full sm:w-auto">
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePreview(environment.id)}
                                  className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
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
