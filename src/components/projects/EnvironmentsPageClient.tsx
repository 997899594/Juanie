'use client';

import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  Globe,
  Plus,
  Rocket,
  ScrollText,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { RuntimeSectionNav } from '@/components/projects/RuntimeSectionNav';
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
import { Switch } from '@/components/ui/switch';
import {
  cleanupPreviewEnvironments,
  createPreviewEnvironment,
  type DatabaseSchemaRepairPlan,
  type DeliveryRoutingRuleInput,
  deletePreviewEnvironment,
  fetchProjectEnvironments,
  type PromotionFlowInput,
  updateDeliveryControl,
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

type SchemaStateStatus = NonNullable<
  EnvironmentRecord['databases'][number]['schemaState']
>['status'];

const deploymentStrategyOptions = [
  { value: 'rolling', label: '滚动发布' },
  { value: 'controlled', label: '受控放量' },
  { value: 'canary', label: '金丝雀' },
  { value: 'blue_green', label: '蓝绿切换' },
] as const;

const deliveryRuleKindOptions = [
  { value: 'branch', label: '分支' },
  { value: 'tag', label: '标签' },
  { value: 'pull_request', label: 'PR' },
  { value: 'manual', label: '手动' },
] as const;

const promotionStrategyOptions = [
  { value: 'reuse_release_artifacts', label: '复用已验证产物' },
  { value: 'rebuild_from_ref', label: '从源码重新构建' },
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
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
          <DialogTitle>新建预览环境</DialogTitle>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
              <div className="space-y-4">
                {disabledSummary && (
                  <div className="console-card rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                    {disabledSummary}
                  </div>
                )}

                <div className="console-surface p-4 sm:p-5">
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
                  <div className="mt-4 space-y-2">
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

                  <div className="mt-4 space-y-2">
                    <Label>数据库策略</Label>
                    <Select
                      value={databaseStrategy}
                      onValueChange={(value: 'inherit' | 'isolated_clone') =>
                        setDatabaseStrategy(value)
                      }
                      disabled={loading || disabled}
                    >
                      <SelectTrigger className="rounded-xl">
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
                </div>

                {error && (
                  <div className="rounded-2xl bg-destructive/[0.06] px-4 py-3 text-sm text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
                    {error}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] bg-secondary/20 p-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_10px_24px_rgba(55,53,47,0.03)] sm:p-5">
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl bg-background/90 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_18px_rgba(55,53,47,0.03)]">
                      <div className="text-xs text-muted-foreground">标识来源</div>
                      <div className="mt-1 text-foreground">
                        {branch ? `分支 ${branch}` : prNumber ? `PR #${prNumber}` : '等待输入'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-background/90 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_18px_rgba(55,53,47,0.03)]">
                      <div className="text-xs text-muted-foreground">启动方式</div>
                      <div className="mt-1 text-foreground">按远端最新提交直接发布</div>
                    </div>
                    <div className="rounded-2xl bg-background/90 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_18px_rgba(55,53,47,0.03)]">
                      <div className="text-xs text-muted-foreground">保留时长</div>
                      <div className="mt-1 text-foreground">
                        {ttlHours ? `${ttlHours} 小时` : '默认 72 小时'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-background/90 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_18px_rgba(55,53,47,0.03)]">
                      <div className="text-xs text-muted-foreground">数据库方案</div>
                      <div className="mt-1 text-foreground">
                        {databaseStrategy === 'isolated_clone' ? '独立预览库' : '继承基础数据库'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="w-full rounded-xl sm:w-auto"
              disabled={loading || disabled}
            >
              {loading ? '启动中...' : '启动预览环境'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function statusToneClass(color: ActivityStatusDecoration['color']): string {
  switch (color) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-destructive';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-muted-foreground';
  }
}

function getSchemaStateBadgeClass(status: SchemaStateStatus | null | undefined): string {
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
    case 'unmanaged':
      return 'border-muted-foreground/40 text-muted-foreground';
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

function EnvironmentQuickActions({
  projectId,
  environment,
}: {
  projectId: string;
  environment: EnvironmentRecord;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {environment.primaryDomainUrl && (
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <a href={environment.primaryDomainUrl} target="_blank" rel="noreferrer">
            环境
          </a>
        </Button>
      )}
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href={`/projects/${projectId}/environments/${environment.id}`}>概览</Link>
      </Button>
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href={`/projects/${projectId}/environments/${environment.id}/logs`}>日志</Link>
      </Button>
      {environment.latestReleaseCard && (
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href={`/projects/${projectId}/delivery/${environment.latestReleaseCard.id}`}>
            交付
          </Link>
        </Button>
      )}
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href={`/projects/${projectId}/environments/${environment.id}/diagnostics`}>诊断</Link>
      </Button>
    </div>
  );
}

function EnvironmentRecentActivityPanel({ items }: { items: EnvironmentRecord['recentActivity'] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="console-surface mb-4 rounded-2xl px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">最近活动</div>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="console-card flex flex-col gap-3 rounded-2xl px-4 py-3 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.kindLabel}</Badge>
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                {item.statusDecoration && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        statusToneClass(item.statusDecoration.color),
                        item.statusDecoration.pulse && 'animate-pulse'
                      )}
                    />
                    <span>{item.statusDecoration.label}</span>
                  </div>
                )}
                {item.createdAtLabel && (
                  <div className="text-xs text-muted-foreground">{item.createdAtLabel}</div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{item.summary}</div>
            </div>
            {item.href && item.actionLabel && (
              <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl px-3 lg:shrink-0">
                <Link href={item.href}>{item.actionLabel}</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
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

function toEditableRoutingRule(rule: DeliveryControlRuleRecord): DeliveryRoutingRuleInput {
  return {
    environmentId: rule.environmentId ?? '',
    kind: rule.kind,
    pattern: rule.pattern,
    priority: rule.priority,
    isActive: rule.isActive,
    autoCreateEnvironment: rule.autoCreateEnvironment,
  };
}

function toEditablePromotionFlow(flow: DeliveryControlFlowRecord): PromotionFlowInput {
  return {
    sourceEnvironmentId: flow.sourceEnvironmentId ?? '',
    targetEnvironmentId: flow.targetEnvironmentId ?? '',
    requiresApproval: flow.requiresApproval,
    strategy: flow.strategy,
    isActive: flow.isActive,
  };
}

function createRuleDraft(
  environments: DeliveryControlEnvironmentOption[]
): DeliveryRoutingRuleInput {
  return {
    environmentId: environments[0]?.id ?? '',
    kind: 'branch',
    pattern: '',
    priority: 100,
    isActive: true,
    autoCreateEnvironment: false,
  };
}

function createFlowDraft(environments: DeliveryControlEnvironmentOption[]): PromotionFlowInput {
  const sourceEnvironmentId = environments[0]?.id ?? '';
  const targetEnvironmentId = environments[1]?.id ?? environments[0]?.id ?? '';

  return {
    sourceEnvironmentId,
    targetEnvironmentId,
    requiresApproval: true,
    strategy: 'reuse_release_artifacts',
    isActive: true,
  };
}

function DeliveryControlPanel({
  deliveryControl,
  routingRules,
  promotionFlows,
  editing,
  saving,
  onToggleEditing,
  onReset,
  onSave,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onAddFlow,
  onUpdateFlow,
  onRemoveFlow,
}: {
  deliveryControl: DeliveryControlState;
  routingRules: DeliveryRoutingRuleInput[];
  promotionFlows: PromotionFlowInput[];
  editing: boolean;
  saving: boolean;
  onToggleEditing: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  onAddRule: () => void;
  onUpdateRule: (index: number, rule: DeliveryRoutingRuleInput) => void;
  onRemoveRule: (index: number) => void;
  onAddFlow: () => void;
  onUpdateFlow: (index: number, flow: PromotionFlowInput) => void;
  onRemoveFlow: (index: number) => void;
}) {
  const persistentEnvironments = deliveryControl.environments.filter(
    (environment) => environment.kind !== 'preview'
  );
  const displayedRoutingRules = editing ? routingRules : deliveryControl.routingRules;
  const displayedPromotionFlows = editing ? promotionFlows : deliveryControl.promotionFlows;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Rocket className="h-4 w-4" />
          交付控制面
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onReset}>
              丢弃
            </Button>
          )}
          {deliveryControl.editable ? (
            editing ? (
              <Button
                size="sm"
                className="rounded-xl"
                disabled={saving}
                onClick={() => void onSave()}
              >
                {saving ? '保存中...' : '保存链路'}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onToggleEditing}>
                编辑链路
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="ui-control-muted rounded-[20px] px-4 py-3 text-sm text-muted-foreground">
        {deliveryControl.editSummary}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="console-panel overflow-hidden">
          <div className="console-divider-bottom px-4 py-3">
            <div className="text-sm font-medium">Git 路由规则</div>
          </div>
          <div className="space-y-3 px-4 py-4">
            {displayedRoutingRules.length === 0 ? (
              <div className="ui-control-muted rounded-[18px] px-4 py-4 text-sm text-muted-foreground">
                还没有路由规则
              </div>
            ) : (
              displayedRoutingRules.map((rule, index) => (
                <div
                  key={rule.id ?? `${rule.kind}-${index}`}
                  className="console-surface rounded-[18px] px-4 py-4"
                >
                  {editing ? (
                    <div className="space-y-3">
                      {(() => {
                        const editableRule = rule as DeliveryRoutingRuleInput;

                        return (
                          <>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>目标环境</Label>
                                <Select
                                  value={editableRule.environmentId}
                                  onValueChange={(value) =>
                                    onUpdateRule(index, { ...editableRule, environmentId: value })
                                  }
                                >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="选择环境" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {persistentEnvironments.map((environment) => (
                                      <SelectItem key={environment.id} value={environment.id}>
                                        {environment.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>来源类型</Label>
                                <Select
                                  value={editableRule.kind}
                                  onValueChange={(value: DeliveryRoutingRuleInput['kind']) =>
                                    onUpdateRule(index, {
                                      ...editableRule,
                                      kind: value,
                                      autoCreateEnvironment:
                                        value === 'pull_request'
                                          ? true
                                          : editableRule.autoCreateEnvironment,
                                      pattern: value === 'manual' ? null : editableRule.pattern,
                                    })
                                  }
                                >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="选择规则类型" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {deliveryRuleKindOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {editableRule.kind !== 'manual' && (
                              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                                <div className="space-y-2">
                                  <Label>Pattern</Label>
                                  <Input
                                    value={editableRule.pattern ?? ''}
                                    onChange={(event) =>
                                      onUpdateRule(index, {
                                        ...editableRule,
                                        pattern: event.target.value,
                                      })
                                    }
                                    placeholder={
                                      editableRule.kind === 'pull_request' ? '*' : 'main'
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>优先级</Label>
                                  <Input
                                    inputMode="numeric"
                                    value={String(editableRule.priority)}
                                    onChange={(event) =>
                                      onUpdateRule(index, {
                                        ...editableRule,
                                        priority: Number.parseInt(event.target.value || '100', 10),
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={editableRule.isActive}
                                  onCheckedChange={(checked) =>
                                    onUpdateRule(index, { ...editableRule, isActive: checked })
                                  }
                                />
                                <span>启用</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={editableRule.autoCreateEnvironment}
                                  disabled={editableRule.kind !== 'pull_request'}
                                  onCheckedChange={(checked) =>
                                    onUpdateRule(index, {
                                      ...editableRule,
                                      autoCreateEnvironment: checked,
                                    })
                                  }
                                />
                                <span>自动创建预览</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto rounded-xl text-destructive"
                                onClick={() => onRemoveRule(index)}
                              >
                                删除
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {deliveryRuleKindOptions.find((option) => option.value === rule.kind)
                            ?.label ?? rule.kind}
                        </Badge>
                        <div className="text-sm font-medium text-foreground">
                          {'environmentName' in rule
                            ? (rule.environmentName ?? '未绑定环境')
                            : '未绑定环境'}
                        </div>
                        <Badge variant="outline">{rule.isActive ? '已启用' : '已停用'}</Badge>
                        {rule.autoCreateEnvironment ? (
                          <Badge variant="outline">自动创建预览</Badge>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[rule.pattern ? `匹配 ${rule.pattern}` : null, `优先级 ${rule.priority}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {editing && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onAddRule}>
                <Plus className="h-4 w-4" />
                添加路由
              </Button>
            )}
          </div>
        </div>

        <div className="console-panel overflow-hidden">
          <div className="console-divider-bottom px-4 py-3">
            <div className="text-sm font-medium">环境推广链路</div>
          </div>
          <div className="space-y-3 px-4 py-4">
            {displayedPromotionFlows.length === 0 ? (
              <div className="ui-control-muted rounded-[18px] px-4 py-4 text-sm text-muted-foreground">
                还没有推广链路
              </div>
            ) : (
              displayedPromotionFlows.map((flow, index) => (
                <div
                  key={
                    flow.id ?? `${flow.sourceEnvironmentId}-${flow.targetEnvironmentId}-${index}`
                  }
                  className="console-surface rounded-[18px] px-4 py-4"
                >
                  {editing ? (
                    <div className="space-y-3">
                      {(() => {
                        const editableFlow = flow as PromotionFlowInput;

                        return (
                          <>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>源环境</Label>
                                <Select
                                  value={editableFlow.sourceEnvironmentId}
                                  onValueChange={(value) =>
                                    onUpdateFlow(index, {
                                      ...editableFlow,
                                      sourceEnvironmentId: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="选择源环境" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {persistentEnvironments.map((environment) => (
                                      <SelectItem key={environment.id} value={environment.id}>
                                        {environment.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>目标环境</Label>
                                <Select
                                  value={editableFlow.targetEnvironmentId}
                                  onValueChange={(value) =>
                                    onUpdateFlow(index, {
                                      ...editableFlow,
                                      targetEnvironmentId: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="选择目标环境" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {persistentEnvironments.map((environment) => (
                                      <SelectItem key={environment.id} value={environment.id}>
                                        {environment.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>策略</Label>
                              <Select
                                value={editableFlow.strategy}
                                onValueChange={(value: PromotionFlowInput['strategy']) =>
                                  onUpdateFlow(index, { ...editableFlow, strategy: value })
                                }
                              >
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue placeholder="选择策略" />
                                </SelectTrigger>
                                <SelectContent>
                                  {promotionStrategyOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={editableFlow.requiresApproval}
                                  onCheckedChange={(checked) =>
                                    onUpdateFlow(index, {
                                      ...editableFlow,
                                      requiresApproval: checked,
                                    })
                                  }
                                />
                                <span>需要审批</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={editableFlow.isActive}
                                  onCheckedChange={(checked) =>
                                    onUpdateFlow(index, { ...editableFlow, isActive: checked })
                                  }
                                />
                                <span>启用</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto rounded-xl text-destructive"
                                onClick={() => onRemoveFlow(index)}
                              >
                                删除
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {'sourceEnvironmentName' in flow && 'targetEnvironmentName' in flow
                            ? `${flow.sourceEnvironmentName ?? flow.sourceEnvironmentId ?? '未绑定'} → ${
                                flow.targetEnvironmentName ?? flow.targetEnvironmentId ?? '未绑定'
                              }`
                            : `${flow.sourceEnvironmentId} → ${flow.targetEnvironmentId}`}
                        </Badge>
                        <Badge variant="outline">{flow.isActive ? '已启用' : '已停用'}</Badge>
                        {flow.requiresApproval ? <Badge variant="outline">需要审批</Badge> : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {promotionStrategyOptions.find((option) => option.value === flow.strategy)
                          ?.label ?? flow.strategy}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {editing && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onAddFlow}>
                <Plus className="h-4 w-4" />
                添加链路
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildEnvironmentHeaderMeta(environment: EnvironmentRecord): string {
  return [
    environment.namespace ?? '尚未部署',
    environment.scopeLabel,
    environment.sourceLabel,
    environment.expiryLabel,
    environment.latestReleaseCard?.shortCommitSha
      ? `最近发布 ${environment.latestReleaseCard.shortCommitSha}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function EnvironmentCardHeader({
  environment,
  expanded,
  onToggle,
}: {
  environment: EnvironmentRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/20"
    >
      <div className="min-w-0 space-y-1.5">
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
          {environment.scopeLabel && <Badge variant="outline">{environment.scopeLabel}</Badge>}
          {environment.previewLifecycle && (
            <Badge variant="secondary">{environment.previewLifecycle.stateLabel}</Badge>
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {buildEnvironmentHeaderMeta(environment)}
        </div>
      </div>
      {expanded ? (
        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function EnvironmentRuntimePanel({
  projectId,
  environment,
}: {
  projectId: string;
  environment: EnvironmentRecord;
}) {
  return (
    <div className="console-surface rounded-2xl px-4 py-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">环境</div>
        </div>
        {environment.previewLifecycle && (
          <Badge variant="outline">{environment.previewLifecycle.stateLabel}</Badge>
        )}
      </div>

      {environment.latestReleaseCard && (
        <div className="console-card mt-4 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">最近发布</Badge>
            <Badge variant="outline">{environment.latestReleaseCard.statusDecoration.label}</Badge>
            {environment.latestReleaseCard.shortCommitSha && (
              <code className="rounded bg-background px-2 py-1 text-[11px] font-mono">
                {environment.latestReleaseCard.shortCommitSha}
              </code>
            )}
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {environment.latestReleaseCard.title}
          </div>
          {environment.latestReleaseCard.createdAtLabel && (
            <div className="mt-1 text-xs text-muted-foreground">
              {environment.latestReleaseCard.createdAtLabel}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <EnvironmentQuickActions projectId={projectId} environment={environment} />
      </div>
    </div>
  );
}

function EnvironmentPolicyPanel({
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
    <div className="console-surface rounded-2xl px-4 py-4">
      <div className="mb-4 text-sm font-medium">策略</div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="console-card px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            环境定位
          </div>
          <div className="mt-2 text-sm text-foreground">
            {[environment.scopeLabel, environment.sourceLabel].filter(Boolean).join(' · ') ||
              '固定环境'}
          </div>
        </div>
        <div className="console-card px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            数据库策略
          </div>
          <div className="mt-2 text-sm text-foreground">
            {[environment.databaseStrategyLabel, environment.inheritanceLabel]
              .filter(Boolean)
              .join(' · ') || '使用默认数据库策略'}
          </div>
        </div>
      </div>

      {(environment.previewLifecycle || environment.cleanupState) && (
        <div className="console-card mt-3 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            生命周期
          </div>
          <div className="mt-2 text-sm text-foreground">
            {environment.previewLifecycle?.stateLabel ??
              environment.cleanupState?.label ??
              environment.expiryLabel ??
              '稳定'}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          发布策略
        </div>
        <div className="text-xs text-muted-foreground">
          {environment.actions.configureStrategySummary}
        </div>
        <Select
          value={environment.deploymentStrategy ?? 'rolling'}
          onValueChange={(value: 'rolling' | 'controlled' | 'canary' | 'blue_green') =>
            onStrategyChange(value)
          }
          disabled={savingStrategy || !environment.actions.canConfigureStrategy}
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
    </div>
  );
}

function EnvironmentAdvancedPanel({
  projectId,
  environment,
}: {
  projectId: string;
  environment: EnvironmentRecord;
}) {
  const blockingCount = environment.databases.filter((database) =>
    ['aligned_untracked', 'drifted', 'unmanaged', 'blocked'].includes(
      database.schemaState?.status ?? 'unmanaged'
    )
  ).length;
  const pendingCount = environment.databases.filter(
    (database) => database.schemaState?.status === 'pending_migrations'
  ).length;

  return (
    <details className="console-surface rounded-2xl px-4 py-4">
      <summary className="cursor-pointer list-none text-sm font-medium">更多</summary>
      <div className="mt-4 space-y-4">
        {environment.databases.length > 0 && (
          <div className="console-card px-4 py-4">
            <div className="mb-3">
              <div className="text-sm font-medium">数据库纳管</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="console-surface px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  摘要
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {[
                    `直连 ${environment.databaseBindingSummary.directCount} 个`,
                    `实际使用 ${environment.databaseBindingSummary.effectiveCount} 个`,
                    environment.databaseBindingSummary.inheritedCount > 0
                      ? `继承 ${environment.databaseBindingSummary.inheritedCount} 个`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {`门禁阻塞 ${blockingCount} · 待迁移 ${pendingCount}`}
                </div>
              </div>
              <div className="console-surface px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  数据
                </div>
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                  <Link href={`/projects/${projectId}/schema?env=${environment.id}`}>数据</Link>
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {environment.databases.map((database) => {
                return (
                  <div key={database.id} className="console-surface rounded-2xl px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-foreground">{database.name}</div>
                      <Badge variant="secondary">{database.type}</Badge>
                      <Badge variant="outline">{database.usageLabel}</Badge>
                      <Badge
                        variant="outline"
                        className={getSchemaStateBadgeClass(database.schemaState?.status)}
                      >
                        {database.schemaState?.statusLabel ?? '未纳管'}
                      </Badge>
                      {database.latestRepairPlan ? (
                        <Badge variant="outline">{database.latestRepairPlan.status}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {database.schemaState?.summary ?? '尚未识别 schema 状态'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {environment.domains.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {environment.domains.map((domain) => (
              <a
                key={domain.id}
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-foreground shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.03)]"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{domain.hostname}</span>
                {domain.service?.name && <Badge variant="secondary">{domain.service.name}</Badge>}
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={`/projects/${projectId}/environments/${environment.id}/variables`}>
              变量
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={`/projects/${projectId}/environments/${environment.id}/logs`}>日志</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={`/projects/${projectId}/environments/${environment.id}/diagnostics`}>
              诊断
            </Link>
          </Button>
          {environment.primaryDomainUrl ? (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href={environment.primaryDomainUrl} target="_blank" rel="noreferrer">
                地址
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function EnvironmentExpandedContent({
  projectId,
  environment,
  savingStrategy,
  onStrategyChange,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  savingStrategy: boolean;
  onStrategyChange: (
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <EnvironmentRuntimePanel projectId={projectId} environment={environment} />
        <EnvironmentRecentActivityPanel items={environment.recentActivity} />
      </div>
      <div className="space-y-4">
        <EnvironmentPolicyPanel
          environment={environment}
          savingStrategy={savingStrategy}
          onStrategyChange={onStrategyChange}
        />
        <EnvironmentAdvancedPanel projectId={projectId} environment={environment} />
      </div>
    </div>
  );
}

interface EnvironmentsPageClientProps {
  projectId: string;
  initialEnvId?: string | null;
  focusMode?: boolean;
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
  const [governance, setGovernance] = useState(initialData.governance);
  const [deliveryControl, setDeliveryControl] = useState(initialData.deliveryControl);
  const [routingRules, setRoutingRules] = useState<DeliveryRoutingRuleInput[]>(
    initialData.deliveryControl.routingRules.map(toEditableRoutingRule)
  );
  const [promotionFlows, setPromotionFlows] = useState<PromotionFlowInput[]>(
    initialData.deliveryControl.promotionFlows.map(toEditablePromotionFlow)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleaningExpired, setCleaningExpired] = useState(false);
  const [savingStrategyId, setSavingStrategyId] = useState<string | null>(null);
  const [editingDeliveryControl, setEditingDeliveryControl] = useState(false);
  const [savingDeliveryControl, setSavingDeliveryControl] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const data =
        await fetchProjectEnvironments<EnvironmentsPageClientProps['initialData']>(projectId);
      setEnvironments(data.environments);
      setGovernance(data.governance);
      setDeliveryControl(data.deliveryControl);
      setRoutingRules(data.deliveryControl.routingRules.map(toEditableRoutingRule));
      setPromotionFlows(data.deliveryControl.promotionFlows.map(toEditablePromotionFlow));
      setEditingDeliveryControl(false);
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

  const toggleExpanded = (envId: string) => {
    setExpanded((prev) => ({ ...prev, [envId]: !prev[envId] }));
  };

  const resetDeliveryControlEditor = useCallback(() => {
    setRoutingRules(deliveryControl.routingRules.map(toEditableRoutingRule));
    setPromotionFlows(deliveryControl.promotionFlows.map(toEditablePromotionFlow));
    setEditingDeliveryControl(false);
  }, [deliveryControl]);

  const handleSaveDeliveryControl = useCallback(async () => {
    setSavingDeliveryControl(true);

    try {
      await updateDeliveryControl({
        projectId,
        routingRules,
        promotionFlows,
      });
      await fetchEnvironments();
      setFeedback('交付链路已更新');
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '更新交付链路失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setSavingDeliveryControl(false);
    }
  }, [fetchEnvironments, projectId, promotionFlows, routingRules]);

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

  const handleCleanupExpiredPreviews = async () => {
    if (cleaningExpired) return;
    setCleaningExpired(true);

    try {
      const result = await cleanupPreviewEnvironments(projectId);
      const parts = [];

      if (result.deletedIds.length > 0) {
        parts.push(`已回收 ${result.deletedIds.length} 个过期预览环境`);
      }

      if (result.skipped.length > 0) {
        parts.push(`${result.skipped.length} 个仍被活跃发布阻塞`);
      }

      setFeedback(parts.join(' · ') || '没有可回收项');
      await fetchEnvironments();
      setTimeout(() => setFeedback(null), 5000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '执行预览环境治理失败');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setCleaningExpired(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={focusMode && focusedEnvironment ? focusedEnvironment.name : '环境'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {focusMode && focusedEnvironment ? (
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/environments`}>全部环境</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/delivery`}>
                <Rocket className="h-4 w-4" />
                发布
              </Link>
            </Button>
            {focusedEnvironment ? (
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/environments/${focusedEnvironment.id}/logs`}>
                  <ScrollText className="h-4 w-4" />
                  日志
                </Link>
              </Button>
            ) : null}
            {!focusMode ? (
              <Button
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

      <RuntimeSectionNav
        projectId={projectId}
        environmentId={focusMode ? focusedEnvironment?.id : null}
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
        <div className="console-surface rounded-2xl px-4 py-3 text-sm text-foreground">
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
            <section className="space-y-3">
              <div className="text-sm font-semibold">当前环境</div>
              <div className="console-panel overflow-hidden">
                <div className="px-5 py-4">
                  <EnvironmentExpandedContent
                    projectId={projectId}
                    environment={focusedEnvironment}
                    savingStrategy={savingStrategyId === focusedEnvironment.id}
                    onStrategyChange={(value) => handleStrategyChange(focusedEnvironment.id, value)}
                  />
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Globe className="h-4 w-4" />
                  核心环境
                </div>
                {standardEnvironments.length === 0 ? (
                  <div className="ui-control-muted rounded-[20px] px-5 py-8 text-sm text-muted-foreground">
                    暂无环境
                  </div>
                ) : (
                  <div className="space-y-3">
                    {standardEnvironments.map((environment) => {
                      const isExpanded = !!expanded[environment.id];
                      return (
                        <div key={environment.id} className="console-panel overflow-hidden">
                          <EnvironmentCardHeader
                            environment={environment}
                            expanded={isExpanded}
                            onToggle={() => toggleExpanded(environment.id)}
                          />

                          {isExpanded && (
                            <div className="px-5 py-4">
                              <EnvironmentExpandedContent
                                projectId={projectId}
                                environment={environment}
                                savingStrategy={savingStrategyId === environment.id}
                                onStrategyChange={(value) =>
                                  handleStrategyChange(environment.id, value)
                                }
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
                  <div className="ui-control-muted rounded-[20px] px-5 py-8 text-sm text-muted-foreground">
                    暂无预览环境
                  </div>
                ) : (
                  <div className="space-y-3">
                    {previewEnvironments.map((environment) => {
                      const isExpanded = !!expanded[environment.id];

                      return (
                        <div key={environment.id} className="console-panel overflow-hidden">
                          <div className="flex items-start justify-between gap-3 px-5 py-4">
                            <div className="min-w-0 flex-1">
                              <EnvironmentCardHeader
                                environment={environment}
                                expanded={isExpanded}
                                onToggle={() => toggleExpanded(environment.id)}
                              />
                            </div>

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
                                      deletingId === environment.id ||
                                      !environment.actions?.canDelete
                                    }
                                  >
                                    {deletingId === environment.id ? '处理中...' : '确认结束'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {isExpanded && (
                            <div className="px-5 py-4">
                              <EnvironmentExpandedContent
                                projectId={projectId}
                                environment={environment}
                                savingStrategy={savingStrategyId === environment.id}
                                onStrategyChange={(value) =>
                                  handleStrategyChange(environment.id, value)
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          <details className="ui-floating overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">链路与治理</div>
                <div className="text-xs text-muted-foreground">
                  {governance.roleLabel} · 预览 {governance.cleanupPreviews.eligibleCount} 可回收 /{' '}
                  {governance.cleanupPreviews.blockedCount} 阻塞
                </div>
              </div>
              <Badge variant="outline">次级控制面</Badge>
            </summary>

            <div className="console-divider-top space-y-6 px-4 py-4">
              <div className="ui-control-muted rounded-[20px] px-4 py-3">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {governance.manageEnvVars.allowed
                      ? '可管理变量'
                      : governance.manageEnvVars.summary}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={handleCleanupExpiredPreviews}
                    disabled={!governance.cleanupPreviews.allowed || cleaningExpired}
                  >
                    {cleaningExpired ? '治理中...' : '治理预览'}
                  </Button>
                </div>
              </div>

              <DeliveryControlPanel
                deliveryControl={deliveryControl}
                routingRules={routingRules}
                promotionFlows={promotionFlows}
                editing={editingDeliveryControl}
                saving={savingDeliveryControl}
                onToggleEditing={() => setEditingDeliveryControl(true)}
                onReset={resetDeliveryControlEditor}
                onSave={handleSaveDeliveryControl}
                onAddRule={() =>
                  setRoutingRules((current) => [
                    ...current,
                    createRuleDraft(deliveryControl.environments),
                  ])
                }
                onUpdateRule={(index, rule) =>
                  setRoutingRules((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? rule : item))
                  )
                }
                onRemoveRule={(index) =>
                  setRoutingRules((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                onAddFlow={() =>
                  setPromotionFlows((current) => [
                    ...current,
                    createFlowDraft(deliveryControl.environments),
                  ])
                }
                onUpdateFlow={(index, flow) =>
                  setPromotionFlows((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? flow : item))
                  )
                }
                onRemoveFlow={(index) =>
                  setPromotionFlows((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              />
            </div>
          </details>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="ui-floating flex items-center gap-2 rounded-[24px] p-2 backdrop-blur">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
            <Link href={`/projects/${projectId}/environments`}>
              <Globe className="h-4 w-4" />
              环境
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
            <Link href={`/projects/${projectId}/delivery`}>
              <Rocket className="h-4 w-4" />
              发布
            </Link>
          </Button>
          {focusedEnvironment ? (
            <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
              <Link href={`/projects/${projectId}/environments/${focusedEnvironment.id}/logs`}>
                <ScrollText className="h-4 w-4" />
                日志
              </Link>
            </Button>
          ) : null}
          {!focusMode ? (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={!governance.createPreview.allowed}
            >
              <Plus className="h-4 w-4" />
              预览
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
