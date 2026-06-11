'use client';
import { Activity, ArrowRight, Database, ExternalLink, Globe, Package2 } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  DeliveryArtifactList,
  type DeliveryArtifactListItem,
} from '@/components/projects/DeliveryArtifactList';
import { EnvironmentRollbackAction } from '@/components/projects/EnvironmentRollbackAction';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
import { PromotionAction } from '@/components/projects/PromotionAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageBackAction, PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { StatusIndicator } from '@/components/ui/status-indicator';
import {
  setEnvironmentRuntimeState as controlEnvironmentRuntime,
  type DatabaseSchemaRepairPlan,
  type DeliveryRoutingRuleInput,
  type EnvironmentRuntimeState,
  fetchProjectEnvironments,
  type PromotionFlowInput,
} from '@/lib/environments/client-actions';
import {
  buildEnvironmentDatabaseSummary,
  buildEnvironmentHeaderMeta,
  buildEnvironmentSourceSummary,
  buildEnvironmentVersionSummary,
  buildRuntimeStateLabel,
  getRuntimeAction,
} from '@/lib/environments/client-view-model';
import type { ReleasePageGovernanceSnapshot } from '@/lib/releases/governance-view';
import type { ProjectPromotionPlanView } from '@/lib/releases/service';
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
    sourceRelease?: {
      id: string;
      title: string;
      environmentId: string | null;
      environmentName: string;
      shortCommitSha: string | null;
    } | null;
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
  latestDeliveryArtifacts: DeliveryArtifactListItem[];
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

function EnvironmentOverviewPanel({
  projectId,
  environment,
  promotionAction,
  rollbackAction,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  promotionAction?: ReactNode;
  rollbackAction?: ReactNode;
  runtimeAction?: ReactNode;
}) {
  const sourceSummary = buildEnvironmentSourceSummary(environment);
  const versionSummary = buildEnvironmentVersionSummary(environment);
  const statusSummary =
    environment.runtimeState?.summary ?? environment.platformSignals.primarySummary;
  const databaseSummary = buildEnvironmentDatabaseSummary(environment);
  const schemaIssueSummary = environment.databases.find((database) => database.schemaState?.summary)
    ?.schemaState?.summary;
  const shellClassName = 'console-panel px-5 py-5';
  const deliveryHref = `/projects/${projectId}/environments/${environment.id}/delivery`;
  const primaryDomainHost = environment.primaryDomainUrl?.replace(/^https?:\/\//, '') ?? null;
  const sourceRelease = environment.latestReleaseCard?.sourceRelease ?? null;
  const statusLabel = buildRuntimeStateLabel(environment.runtimeState);
  const latestReleaseHref = environment.latestReleaseCard
    ? `${deliveryHref}/${environment.latestReleaseCard.id}`
    : deliveryHref;

  return (
    <div className="space-y-4">
      <section className="console-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
          <div className="px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusIndicator
                status={environment.latestReleaseCard?.statusDecoration.color ?? 'neutral'}
                pulse={environment.latestReleaseCard?.statusDecoration.pulse ?? false}
                label={environment.latestReleaseCard?.statusDecoration.label ?? statusLabel}
              />
              <Badge variant="secondary">{environment.scopeLabel ?? '环境'}</Badge>
              {environment.sourceLabel ? (
                <Badge variant="secondary">{environment.sourceLabel}</Badge>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <EnvironmentFact
                label="当前状态"
                value={statusLabel}
                summary={statusSummary ?? (buildEnvironmentHeaderMeta(environment) || '状态更新中')}
              />
              <EnvironmentFact
                label="当前发布"
                value={versionSummary.label}
                summary={versionSummary.summary || '还没有发布记录'}
                href={latestReleaseHref}
              />
              <EnvironmentFact
                label="来源"
                value={sourceRelease ? `${sourceRelease.environmentName}` : sourceSummary.label}
                summary={
                  sourceRelease
                    ? `${sourceRelease.title}${sourceRelease.shortCommitSha ? ` · ${sourceRelease.shortCommitSha}` : ''}`
                    : sourceSummary.summary
                }
              />
              <EnvironmentFact
                label="数据库"
                value={databaseSummary}
                summary={schemaIssueSummary ?? '数据库状态已纳入环境视图'}
                href={`/projects/${projectId}/environments/${environment.id}/schema`}
              />
            </div>
          </div>

          <div className="border-border/70 border-t px-5 py-5 lg:border-l lg:border-t-0">
            <div className="text-sm font-semibold">操作</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {promotionAction}
              {rollbackAction}
              {runtimeAction}
              <EnvironmentPanelAction
                href={`/projects/${projectId}/environments/${environment.id}/variables`}
              >
                变量
              </EnvironmentPanelAction>
              <EnvironmentPanelAction
                href={`/projects/${projectId}/environments/${environment.id}/schema`}
              >
                数据库
              </EnvironmentPanelAction>
            </div>
            {environment.primaryDomainUrl ? (
              <a
                href={environment.primaryDomainUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{primaryDomainHost}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className={shellClassName}>
          <div className="text-sm font-semibold">运行</div>
          <div className="mt-4 space-y-3">
            <div className="console-inset px-4 py-3">
              <div className="text-sm font-medium text-foreground">{statusLabel}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {environment.runtimeState?.summary ??
                  environment.platformSignals.primarySummary ??
                  '运行态暂不可用'}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <EnvironmentSmallFact label="命名空间" value={environment.namespace ?? '未创建'} />
              <EnvironmentSmallFact label="部署策略" value={environment.strategyLabel ?? '默认'} />
            </div>
          </div>
        </div>

        <div className={shellClassName}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">数据库</div>
            <Button asChild variant="ghost" size="sm" className="h-8 px-3">
              <Link href={`/projects/${projectId}/environments/${environment.id}/schema`}>
                查看
              </Link>
            </Button>
          </div>
          <div className="mt-4 divide-y divide-border/70">
            {environment.databases.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">当前环境没有数据库。</div>
            ) : (
              environment.databases.slice(0, 4).map((database) => (
                <div key={database.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">{database.name}</div>
                    <Badge variant="secondary">
                      {database.schemaState?.statusLabel ?? database.status ?? database.type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {database.schemaState?.summary ?? database.usageLabel}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {environment.latestDeliveryArtifacts.length > 0 ? (
        <section className={cn(shellClassName, 'px-4 py-4 sm:px-5')}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Package2 className="h-4 w-4" />
              交付物
            </div>
            {environment.latestReleaseCard ? (
              <Link
                href={latestReleaseHref}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {environment.latestReleaseCard.title}
              </Link>
            ) : null}
          </div>
          <DeliveryArtifactList
            artifacts={environment.latestDeliveryArtifacts}
            fallbackReleaseId={environment.latestReleaseCard?.id}
          />
        </section>
      ) : null}

      <section className={shellClassName}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">最近活动</div>
          <Button asChild variant="ghost" size="sm" className="h-8 px-3">
            <Link href={deliveryHref}>发布记录</Link>
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {environment.recentActivity.length === 0 ? (
            <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
              暂无发布、部署或迁移活动。
            </div>
          ) : (
            environment.recentActivity.slice(0, 5).map((activity) => (
              <Link
                key={activity.key}
                href={activity.href ?? deliveryHref}
                className="console-inset block px-4 py-3 transition hover:bg-foreground/[0.035]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {activity.kind === 'release' ? (
                      <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : activity.kind === 'migration' ? (
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">
                      {activity.title}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    {activity.createdAtLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {activity.summary}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function EnvironmentPanelAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="h-9 px-4">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function EnvironmentFact({
  label,
  value,
  summary,
  href,
}: {
  label: string;
  value: string;
  summary: string;
  href?: string;
}) {
  const content = (
    <div className="console-inset h-full px-4 py-3 transition hover:bg-foreground/[0.025]">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-foreground">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary}</div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function EnvironmentSmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="console-inset px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function EnvironmentExpandedContent({
  projectId,
  environment,
  promotionAction,
  rollbackAction,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  promotionAction?: ReactNode;
  rollbackAction?: ReactNode;
  runtimeAction?: ReactNode;
}) {
  return (
    <EnvironmentOverviewPanel
      projectId={projectId}
      environment={environment}
      promotionAction={promotionAction}
      rollbackAction={rollbackAction}
      runtimeAction={runtimeAction}
    />
  );
}

interface EnvironmentsPageClientProps {
  projectId: string;
  initialEnvId?: string | null;
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
    promotionGovernance: ReleasePageGovernanceSnapshot;
    deliveryControl: DeliveryControlState;
    promotionPlans: ProjectPromotionPlanView[];
    environments: EnvironmentRecord[];
  };
}

export function EnvironmentsPageClient({
  projectId,
  initialEnvId,
  initialData,
}: EnvironmentsPageClientProps) {
  const [environments, setEnvironments] = useState(initialData.environments);
  const [runtimeActionId, setRuntimeActionId] = useState<string | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const data =
        await fetchProjectEnvironments<EnvironmentsPageClientProps['initialData']>(projectId);
      setEnvironments(data.environments);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载环境失败');
    }
  }, [projectId]);

  const focusedEnvironment =
    (initialEnvId ? environments.find((environment) => environment.id === initialEnvId) : null) ??
    null;

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
        variant="ghost"
        size="sm"
        className="h-9 px-4"
        disabled={runtimeActionId === environment.id}
        onClick={() => handleRuntimeControl(environment, action)}
      >
        {runtimeActionId === environment.id ? '处理中...' : action === 'sleep' ? '休眠' : '唤醒'}
      </Button>
    );
  };

  if (!focusedEnvironment) {
    return (
      <PageShell size="section">
        <PageHeader
          title="环境"
          actions={<PageBackAction label="返回项目总览" href={`/projects/${projectId}`} />}
        />
        <EmptyState icon={<Globe className="h-12 w-12" />} title="环境不存在" />
      </PageShell>
    );
  }

  const focusedEnvironmentMeta = buildEnvironmentHeaderMeta(focusedEnvironment);

  return (
    <PageShell size="section">
      <PageHeader
        title={focusedEnvironment.name}
        description={focusedEnvironmentMeta}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PageBackAction label="返回项目总览" href={`/projects/${projectId}`} />
          </div>
        }
      />

      <EnvironmentSectionNav projectId={projectId} environmentId={focusedEnvironment.id} />

      <EnvironmentExpandedContent
        projectId={projectId}
        environment={focusedEnvironment}
        promotionAction={
          <PromotionAction
            projectId={projectId}
            promotionPlans={initialData.promotionPlans}
            governance={initialData.promotionGovernance}
            sourceEnvironmentId={focusedEnvironment.id}
          />
        }
        rollbackAction={
          <EnvironmentRollbackAction
            projectId={projectId}
            environmentId={focusedEnvironment.id}
            disabled={!focusedEnvironment.actions.canConfigureStrategy}
            disabledSummary={focusedEnvironment.actions.configureStrategySummary}
          />
        }
        runtimeAction={renderRuntimeAction(focusedEnvironment)}
      />
    </PageShell>
  );
}
