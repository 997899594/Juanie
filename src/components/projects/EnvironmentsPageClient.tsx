'use client';
import { Activity, Database, ExternalLink, GitBranch, Globe, Package2 } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { EnvironmentRollbackAction } from '@/components/projects/EnvironmentRollbackAction';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
import { PromotionAction } from '@/components/projects/PromotionAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
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
      provider: 'bytebase';
      label: string;
      workspaceUrl: string;
      sqlEditorUrl: string;
      databaseUrl: string;
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

function EnvironmentOverviewPanel({
  projectId,
  environment,
  incomingFlows,
  outgoingFlows,
  promotionAction,
  rollbackAction,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  incomingFlows: DeliveryControlFlowRecord[];
  outgoingFlows: DeliveryControlFlowRecord[];
  promotionAction?: ReactNode;
  rollbackAction?: ReactNode;
  runtimeAction?: ReactNode;
}) {
  const sourceSummary = buildEnvironmentSourceSummary(environment);
  const versionSummary = buildEnvironmentVersionSummary(environment);
  const statusSummary =
    environment.runtimeState?.summary ?? environment.platformSignals.primarySummary;
  const databaseSummary = buildEnvironmentDatabaseSummary(environment);
  const summaryItems = [
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
      key: 'status',
      label: '状态',
      value: buildRuntimeStateLabel(environment.runtimeState),
      summary: statusSummary ?? '运行态暂不可用',
    },
    {
      key: 'database',
      label: '数据库',
      value: databaseSummary,
      summary:
        environment.databases.find((database) => database.schemaState?.summary)?.schemaState
          ?.summary ?? '数据库状态已纳入环境视图',
    },
  ];
  const shellClassName = 'console-panel px-5 py-5';
  const titleClassName =
    'text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground';
  const deliveryHref = `/projects/${projectId}/environments/${environment.id}/delivery`;
  const primaryDomainHost = environment.primaryDomainUrl?.replace(/^https?:\/\//, '') ?? null;
  const primaryStatusSummary = statusSummary ?? buildEnvironmentHeaderMeta(environment);
  const flowRows = [
    ...incomingFlows.map((flow) => ({
      key: `incoming-${flow.id}`,
      label: '来自',
      value: flow.sourceEnvironmentName ?? '来源环境',
    })),
    ...outgoingFlows.map((flow) => ({
      key: `outgoing-${flow.id}`,
      label: '可提升到',
      value: flow.targetEnvironmentName ?? '目标环境',
    })),
  ];

  return (
    <div className="space-y-4">
      <section className="console-panel px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={titleClassName}>
                {environment.primaryDomainUrl ? '访问地址' : '环境状态'}
              </span>
              {environment.primaryDomainUrl ? (
                <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                  HTTPS
                </Badge>
              ) : null}
            </div>

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              {environment.primaryDomainUrl ? (
                <a
                  href={environment.primaryDomainUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 items-center gap-2 text-xl font-semibold tracking-[-0.035em] text-foreground transition-colors hover:text-foreground/72 sm:text-2xl"
                >
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{primaryDomainHost}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-45 transition-opacity group-hover:opacity-100" />
                </a>
              ) : (
                <div className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-[-0.035em] text-foreground sm:text-2xl">
                  <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {buildRuntimeStateLabel(environment.runtimeState)}
                  </span>
                </div>
              )}

              {primaryStatusSummary ? (
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  {primaryStatusSummary}
                </span>
              ) : null}
            </div>
          </div>

          {promotionAction || rollbackAction || runtimeAction ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {promotionAction}
              {rollbackAction}
              {runtimeAction}
            </div>
          ) : null}
        </div>
      </section>

      <section className={cn(shellClassName, 'px-4 py-4 sm:px-5')}>
        <div className="grid gap-3 md:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.key} className="console-inset relative min-w-0 px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-2 truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                {item.value}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.summary || '等待数据'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <section className={shellClassName}>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="h-4 w-4" />
            交付路径
          </div>
          {flowRows.length > 0 ? (
            <div className="space-y-2">
              {flowRows.map((flow) => (
                <div key={flow.key} className="console-inset px-4 py-3">
                  <div className={titleClassName}>{flow.label}</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{flow.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
              当前环境没有配置提升链路。
            </div>
          )}
        </section>

        <section className={shellClassName}>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4" />
            最近活动
          </div>
          {environment.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {environment.recentActivity.slice(0, 3).map((activity) => (
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
                    {activity.createdAtLabel ? (
                      <span className="text-xs text-muted-foreground">
                        {activity.createdAtLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {activity.summary}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
              暂无发布、部署或迁移活动。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EnvironmentExpandedContent({
  projectId,
  environment,
  incomingFlows,
  outgoingFlows,
  promotionAction,
  rollbackAction,
  runtimeAction,
}: {
  projectId: string;
  environment: EnvironmentRecord;
  incomingFlows: DeliveryControlFlowRecord[];
  outgoingFlows: DeliveryControlFlowRecord[];
  promotionAction?: ReactNode;
  rollbackAction?: ReactNode;
  runtimeAction?: ReactNode;
}) {
  return (
    <EnvironmentOverviewPanel
      projectId={projectId}
      environment={environment}
      incomingFlows={incomingFlows}
      outgoingFlows={outgoingFlows}
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
        className="h-9 rounded-full px-4"
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
          actions={
            <Button asChild variant="ghost" className="h-10 rounded-full px-5">
              <Link href={`/projects/${projectId}`}>返回项目总览</Link>
            </Button>
          }
        />
        <EmptyState icon={<Globe className="h-12 w-12" />} title="环境不存在" />
      </PageShell>
    );
  }

  const focusedEnvironmentMeta = buildEnvironmentHeaderMeta(focusedEnvironment);
  const focusedIncomingFlows = initialData.deliveryControl.promotionFlows.filter(
    (flow) => flow.isActive && flow.targetEnvironmentId === focusedEnvironment.id
  );
  const focusedOutgoingFlows = initialData.deliveryControl.promotionFlows.filter(
    (flow) => flow.isActive && flow.sourceEnvironmentId === focusedEnvironment.id
  );

  return (
    <PageShell size="section">
      <PageHeader
        title={focusedEnvironment.name}
        description={focusedEnvironmentMeta}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="h-10 rounded-full px-5">
              <Link href={`/projects/${projectId}`}>返回项目总览</Link>
            </Button>
          </div>
        }
      />

      <EnvironmentSectionNav projectId={projectId} environmentId={focusedEnvironment.id} />

      <EnvironmentExpandedContent
        projectId={projectId}
        environment={focusedEnvironment}
        incomingFlows={focusedIncomingFlows}
        outgoingFlows={focusedOutgoingFlows}
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
