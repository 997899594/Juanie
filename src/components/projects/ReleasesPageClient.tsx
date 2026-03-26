'use client';

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  GitBranch,
  GitCommit,
  Layers3,
  Rocket,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRollbackAction } from '@/components/projects/DeploymentRollbackAction';
import { DeploymentRolloutAction } from '@/components/projects/DeploymentRolloutAction';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
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
import { PageHeader } from '@/components/ui/page-header';
import { PlatformSignalChipList, PlatformSignalSummary } from '@/components/ui/platform-signals';
import { PreviewSourceSummary } from '@/components/ui/preview-source-summary';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { createProductionRelease } from '@/lib/releases/client-actions';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  autoDeploy: boolean;
  isProduction: boolean;
  isPreview?: boolean | null;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: string | Date | null;
}

interface PromotePlan {
  sourceRelease: {
    id: string;
    summary: string | null;
    sourceCommitSha: string | null;
  } | null;
  plan: {
    canCreate: boolean;
    blockingReason: string | null;
    summary: string | null;
    issue: {
      code: string;
      kind: 'approval' | 'migration' | 'deployment' | 'environment' | 'release';
      label: string;
      summary: string;
      nextActionLabel: string;
    } | null;
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
    migration: {
      preDeployCount: number;
      postDeployCount: number;
      warnings: string[];
      primarySignal: {
        code: string;
        kind: 'migration';
        level: 'warning' | 'approval_required';
        label: string;
        summary: string;
        nextActionLabel: string | null;
      } | null;
      requiresApproval: boolean;
    };
  };
}

interface ReleaseRecord {
  id: string;
  displayTitle: string;
  status: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  triggeredBy: string;
  environment: {
    id: string;
    name: string;
    isProduction: boolean;
    isPreview?: boolean | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: string | Date | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
      service?: {
        id: string;
        name: string;
      } | null;
    }>;
  };
  artifacts: Array<{
    id: string;
    imageUrl: string;
    imageDigest: string | null;
    service: {
      id: string;
      name: string;
    };
  }>;
  deployments: Array<{
    id: string;
    status: string;
    version: string | null;
    imageUrl: string | null;
    createdAt: string | Date;
    serviceId: string | null;
  }>;
  migrationRuns: Array<{
    id: string;
    status: string;
    createdAt: string | Date;
    startedAt: string | Date | null;
    finishedAt: string | Date | null;
    service: {
      id: string;
      name: string;
    } | null;
    database: {
      id: string;
      name: string;
    };
    specification?: {
      tool?: string;
      phase?: string;
      command?: string;
      compatibility: string;
      approvalPolicy: string;
    } | null;
  }>;
  intelligence: {
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    failureSummary: string | null;
    issueCode: string | null;
    actionLabel: string | null;
    issue: {
      code: string;
      kind: 'approval' | 'migration' | 'deployment' | 'environment' | 'release';
      label: string;
      summary: string;
      nextActionLabel: string;
    } | null;
  };
  policy: {
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
  riskLabel: string;
  statusDecoration: {
    color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    pulse: boolean;
    label: string;
  };
  environmentScope: string | null;
  environmentSource: string | null;
  environmentStrategy: string | null;
  environmentDatabaseStrategy: string | null;
  environmentInheritance: string | null;
  environmentExpiry: string | null;
  primaryDomainUrl: string | null;
  approvalRunsCount: number;
  failedMigrationRunsCount: number;
  signalChips: Array<{
    key: string;
    label: string;
    tone: 'danger' | 'neutral';
  }>;
  deploymentItems: Array<{
    id: string;
    status: string;
    serviceId: string | null;
    version: string | null;
    imageUrl: string | null;
    statusDecoration: {
      color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
      pulse: boolean;
      label: string;
    };
    serviceName: string;
  }>;
  migrationItems: Array<{
    id: string;
    status: string;
    serviceId: string | null;
    database: {
      id: string;
      name: string;
    };
    specification: {
      tool: string;
      phase: string;
      command: string;
    };
    statusDecoration: {
      color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
      pulse: boolean;
      label: string;
    };
    imageUrl: string | null;
    serviceName: string;
    createdAtLabel: string;
  }>;
  diffSummary: {
    isFirstRelease: boolean;
    artifactChanges: number;
    migrationChanges: number;
  };
  previewSourceMeta: {
    kind: 'pr' | 'branch' | 'standard';
    label: string | null;
    title: string | null;
    reference: string | null;
    detail: string | null;
    stateLabel: string | null;
    authorName: string | null;
    webUrl: string | null;
  };
  previewLifecycle: {
    stateLabel: string;
    summary: string | null;
    nextActionLabel: string;
  } | null;
  platformSignals: {
    chips: Array<{
      key: string;
      label: string;
      tone: 'danger' | 'neutral';
    }>;
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  actions: {
    canManage: boolean;
    summary: string;
  };
}

function formatImageLabel(imageUrl: string): string {
  const imageName = imageUrl.split('/').pop() ?? imageUrl;
  const [repository, tag] = imageName.split(':');
  if (!tag) return repository;
  return `${repository}:${tag}`;
}

interface ReleasesPageClientProps {
  projectId: string;
  initialData: {
    releases: ReleaseRecord[];
    filteredReleases: ReleaseRecord[];
    environments: Environment[];
    governance: {
      roleLabel: string;
      primarySummary: string;
      manageableEnvironmentIds: string[];
      promoteToProduction: {
        allowed: boolean;
        summary: string;
      };
      manualMigration: {
        allowed: boolean;
        summary: string;
      };
    };
    environmentOptions: string[];
    selectedEnv: string;
    selectedRisk: 'all' | 'attention' | 'approval' | 'failed';
    stats: Array<{
      label: string;
      value: number | string;
    }>;
    promotePlan: PromotePlan | null;
    hasStagingProdSplit: boolean;
  };
}

export function ReleasesPageClient({ projectId, initialData }: ReleasesPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());

  const { isConnected, error } = useReleases({
    projectId,
    onRelease: () => router.refresh(),
  });

  const handlePromote = async () => {
    if (promoting) return;
    setPromoting(true);
    setPromoteResult(null);

    try {
      const data = await createProductionRelease({ projectId });

      setPromoteResult(data.tagName ? `已创建生产发布 · ${data.tagName}` : '已创建生产发布');
      setPromoteDialogOpen(false);
      router.refresh();
    } catch (promoteError) {
      setPromoteResult(
        `错误：${promoteError instanceof Error ? promoteError.message : '创建生产发布失败'}`
      );
    } finally {
      setPromoting(false);
      setTimeout(() => setPromoteResult(null), 5000);
    }
  };

  const updateFilters = (next: {
    env?: string;
    risk?: 'all' | 'attention' | 'approval' | 'failed';
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextEnv = next.env ?? filter;
    const nextRisk = next.risk ?? riskFilter;

    if (nextEnv === 'all') params.delete('env');
    else params.set('env', nextEnv);

    if (nextRisk === 'all') params.delete('risk');
    else params.set('risk', nextRisk);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const releases = initialData.releases;
  const environments = initialData.environments;
  const governance = initialData.governance;
  const filter = initialData.selectedEnv;
  const riskFilter = initialData.selectedRisk;
  const filtered = initialData.filteredReleases;
  const promotePlan = initialData.promotePlan;

  const stagingEnv = environments.find(
    (environment) => environment.autoDeploy && !environment.isProduction
  );
  const latestStagingRelease = stagingEnv
    ? releases.find(
        (release) =>
          release.environment.id === stagingEnv.id &&
          release.status === 'succeeded' &&
          release.artifacts.length > 0
      )
    : null;
  const hasStagingProdSplit = initialData.hasStagingProdSplit;
  const canPromote =
    hasStagingProdSplit &&
    !!latestStagingRelease &&
    governance.promoteToProduction.allowed &&
    (promotePlan?.plan.canCreate ?? true) &&
    !promotePlan?.plan.blockingReason;
  const promotePanel = promotePlan
    ? buildReleasePlanningPanel({
        plan: promotePlan.plan,
        sourceCommitSha: promotePlan.sourceRelease?.sourceCommitSha,
      })
    : null;
  const stats = initialData.stats.map((stat) =>
    stat.label === '实时' ? { ...stat, value: isConnected ? '在线' : '离线' } : stat
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="发布"
        description="发布、迁移与部署记录"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={isConnected ? 'success' : 'neutral'}
              label={isConnected ? '在线' : '离线'}
              pulse={isConnected}
            />
            <ManualReleaseDialog
              projectId={projectId}
              environments={environments.filter((environment) =>
                governance.manageableEnvironmentIds.includes(environment.id)
              )}
              releases={releases}
              disabledSummary={governance.primarySummary}
              onCreated={async () => {
                router.refresh();
              }}
            />
            {hasStagingProdSplit && (
              <Button
                size="sm"
                className="h-9 rounded-xl px-4"
                onClick={() => setPromoteDialogOpen(true)}
                disabled={promoting || !canPromote}
                title={governance.promoteToProduction.summary}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {promoting ? '发布中...' : '发布到生产'}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {promoteResult && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            promoteResult.startsWith('错误')
              ? 'border-destructive/20 bg-background text-destructive'
              : 'border-border bg-secondary/20 text-foreground'
          )}
        >
          {promoteResult}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
        当前角色：{governance.roleLabel}。{governance.primarySummary}。
        {governance.promoteToProduction.summary}。
      </div>

      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>发布到生产</DialogTitle>
            <DialogDescription>
              平台会先沿用 staging 成功版本，再按 preflight 结果创建生产 release。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {promotePanel ? (
              <>
                <PlatformSignalChipList chips={promotePanel.chips} />
                <PlatformSignalSummary
                  summary={promotePanel.issueSummary}
                  nextActionLabel={promotePanel.nextActionLabel}
                />

                {promotePanel.blockingReason && (
                  <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                    {promotePanel.blockingReason}
                  </div>
                )}

                {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
                  <PlatformSignalChipList chips={promotePanel.warningChips} />
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
                正在加载发布预检...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
              关闭
            </Button>
            <Button onClick={handlePromote} disabled={promoting || !canPromote}>
              {promoting ? '发布中...' : '确认发布'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasStagingProdSplit && promotePanel && (
        <div className="console-panel px-4 py-4">
          <PlatformSignalChipList chips={promotePanel.chips} className="items-center" />
          {promotePanel.blockingReason && (
            <div className="mt-3 text-sm text-muted-foreground">{promotePanel.blockingReason}</div>
          )}
          <PlatformSignalSummary
            summary={promotePanel.issueSummary}
            nextActionLabel={promotePanel.nextActionLabel}
            className="mt-3"
          />
          {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
            <PlatformSignalChipList
              chips={promotePanel.warningChips.slice(0, 3)}
              className="mt-3"
            />
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="console-panel space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {initialData.environmentOptions.map((env) => (
            <Button
              key={env}
              variant={filter === env ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilters({ env })}
              className="capitalize"
            >
              {env}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={riskFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilters({ risk: 'all' })}
          >
            全部状态
          </Button>
          <Button
            variant={riskFilter === 'attention' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilters({ risk: 'attention' })}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            待处理
          </Button>
          <Button
            variant={riskFilter === 'approval' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilters({ risk: 'approval' })}
          >
            待审批
          </Button>
          <Button
            variant={riskFilter === 'failed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilters({ risk: 'failed' })}
          >
            失败迁移
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Rocket className="h-12 w-12" />}
          title="还没有发布"
          description="镜像入库或手动触发后，这里会显示完整记录。"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((release) => {
            const expanded = expandedReleases.has(release.id);
            const intelligence = release.intelligence;
            const policy = release.policy;
            const riskTone =
              intelligence.riskLevel === 'high'
                ? 'border-destructive/15 bg-background text-destructive'
                : intelligence.riskLevel === 'medium'
                  ? 'border-border bg-secondary/30 text-foreground'
                  : 'border-border bg-background text-muted-foreground';

            return (
              <div key={release.id} className="console-panel overflow-hidden">
                <div className="flex">
                  <div
                    className={cn(
                      'w-1 shrink-0 self-stretch',
                      release.statusDecoration.color === 'success'
                        ? 'bg-success'
                        : release.statusDecoration.color === 'warning'
                          ? 'bg-warning'
                          : release.statusDecoration.color === 'error'
                            ? 'bg-destructive'
                            : release.statusDecoration.color === 'info'
                              ? 'bg-info'
                              : 'bg-muted-foreground/30'
                    )}
                  />
                  <div className="min-w-0 flex-1 px-5 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusIndicator
                            status={release.statusDecoration.color}
                            pulse={release.statusDecoration.pulse}
                            label={release.statusDecoration.label}
                          />
                          <Badge
                            variant={release.environment.isProduction ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {release.environment.name}
                          </Badge>
                          {release.environmentScope && (
                            <Badge variant="outline">{release.environmentScope}</Badge>
                          )}
                          {release.environmentSource && (
                            <Badge variant="outline">{release.environmentSource}</Badge>
                          )}
                          {release.environmentStrategy && (
                            <Badge variant="outline">{release.environmentStrategy}</Badge>
                          )}
                          {release.environmentDatabaseStrategy && (
                            <Badge variant="outline">{release.environmentDatabaseStrategy}</Badge>
                          )}
                          {release.environmentInheritance && (
                            <Badge variant="outline">{release.environmentInheritance}</Badge>
                          )}
                          {release.previewSourceMeta.label && (
                            <Badge variant="outline">{release.previewSourceMeta.label}</Badge>
                          )}
                          {release.environmentExpiry && (
                            <Badge variant="outline">{release.environmentExpiry}</Badge>
                          )}
                          <Badge variant="outline">{release.artifacts.length} 个服务</Badge>
                          <Badge variant="outline" className="capitalize">
                            {release.triggeredBy}
                          </Badge>
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-medium',
                              riskTone
                            )}
                          >
                            {release.riskLabel}
                          </span>
                          {policy.primarySignal?.label ? (
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                              {policy.primarySignal.label}
                            </span>
                          ) : policy.level !== 'normal' ? (
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                              {policy.level === 'approval_required' ? '受保护 / 待审批' : '受保护'}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <div className="text-base font-semibold">{release.displayTitle}</div>
                          <PreviewSourceSummary meta={release.previewSourceMeta} />
                          {release.platformSignals.primarySummary && (
                            <div className="text-xs text-muted-foreground">
                              {release.platformSignals.primarySummary}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {release.sourceCommitSha && (
                              <div className="flex items-center gap-1.5">
                                <GitCommit className="h-3.5 w-3.5" />
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                                  {release.sourceCommitSha.slice(0, 7)}
                                </code>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <GitBranch className="h-3.5 w-3.5" />
                              <span>{release.sourceRef}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Layers3 className="h-3.5 w-3.5" />
                              <span>
                                {release.deployments.length} 次部署 / {release.migrationRuns.length}{' '}
                                次迁移
                              </span>
                            </div>
                            {release.primaryDomainUrl && (
                              <a
                                href={release.primaryDomainUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                              >
                                <Rocket className="h-3.5 w-3.5" />
                                <span>打开</span>
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {release.artifacts.map((artifact) => (
                            <Badge
                              key={artifact.id}
                              variant="secondary"
                              className="gap-1 rounded-full px-2.5 py-1 font-normal"
                            >
                              <span className="font-medium">{artifact.service.name}</span>
                              <span className="text-muted-foreground">
                                {formatImageLabel(artifact.imageUrl)}
                              </span>
                            </Badge>
                          ))}
                        </div>

                        {release.signalChips.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {release.signalChips.map((chip) => (
                              <span
                                key={chip.key}
                                className={
                                  chip.tone === 'danger'
                                    ? 'rounded-full border border-destructive/15 bg-background px-2.5 py-1 text-destructive'
                                    : 'rounded-full border border-border bg-background px-2.5 py-1 text-foreground'
                                }
                              >
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {release.platformSignals.nextActionLabel && (
                          <div className="text-xs text-muted-foreground">
                            下一步：{release.platformSignals.nextActionLabel}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 xl:flex-col xl:items-end">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(release.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <Link href={`/projects/${projectId}/releases/${release.id}`}>
                              打开
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            onClick={() =>
                              setExpandedReleases((prev) => {
                                const next = new Set(prev);
                                if (next.has(release.id)) next.delete(release.id);
                                else next.add(release.id);
                                return next;
                              })
                            }
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 grid gap-4 border-t border-border pt-4 xl:grid-cols-[1.1fr_1fr]">
                        <div className="space-y-4">
                          <div className="console-card bg-secondary/20 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                              <Rocket className="h-4 w-4" />
                              服务镜像
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {release.artifacts.map((artifact) => (
                                <div
                                  key={artifact.id}
                                  className="rounded-2xl border border-border bg-background px-4 py-3"
                                >
                                  <div className="mb-1 text-sm font-medium">
                                    {artifact.service.name}
                                  </div>
                                  <div className="break-all text-xs text-muted-foreground">
                                    {artifact.imageUrl}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="console-card bg-secondary/20 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                              <ScrollText className="h-4 w-4" />
                              部署进度
                            </div>
                            <div className="space-y-3">
                              {release.deploymentItems.map((deployment) => (
                                <div
                                  key={deployment.id}
                                  className="rounded-2xl border border-border bg-background px-4 py-3"
                                >
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <StatusIndicator
                                      status={deployment.statusDecoration.color}
                                      pulse={deployment.statusDecoration.pulse}
                                      label={deployment.statusDecoration.label}
                                    />
                                    <Badge variant="outline">{deployment.serviceName}</Badge>
                                    {deployment.version && (
                                      <Badge variant="secondary">v{deployment.version}</Badge>
                                    )}
                                  </div>
                                  {deployment.imageUrl && (
                                    <div className="mb-3 break-all text-xs text-muted-foreground">
                                      {deployment.imageUrl}
                                    </div>
                                  )}
                                  <div className="mb-3 flex flex-wrap gap-2">
                                    {release.environment.deploymentStrategy &&
                                      release.environment.deploymentStrategy !== 'rolling' && (
                                        <DeploymentRolloutAction
                                          projectId={projectId}
                                          deploymentId={deployment.id}
                                          strategyLabel={release.environmentStrategy}
                                          disabled={!release.actions.canManage}
                                          disabledSummary={release.actions.summary}
                                        />
                                      )}
                                    <DeploymentRollbackAction
                                      projectId={projectId}
                                      deploymentId={deployment.id}
                                      disabled={!release.actions.canManage}
                                      disabledSummary={release.actions.summary}
                                    />
                                  </div>
                                  <DeploymentLogs
                                    projectId={projectId}
                                    deploymentId={deployment.id}
                                    status={deployment.status}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="console-card bg-secondary/20 p-4">
                          <div className="mb-3 text-sm font-semibold">迁移记录</div>
                          <div className="space-y-3">
                            {release.migrationRuns.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                                没有自动迁移记录
                              </div>
                            ) : (
                              release.migrationItems.map((run) => (
                                <div
                                  key={run.id}
                                  className="rounded-2xl border border-border bg-background px-4 py-3"
                                >
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <StatusIndicator
                                      status={run.statusDecoration.color}
                                      pulse={run.statusDecoration.pulse}
                                      label={run.statusDecoration.label}
                                    />
                                    <Badge variant="outline">{run.database.name}</Badge>
                                  </div>
                                  <div className="text-sm font-medium">{run.serviceName}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {run.createdAtLabel}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
