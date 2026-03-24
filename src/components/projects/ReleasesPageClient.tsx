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
import { useCallback, useEffect, useState } from 'react';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { cn } from '@/lib/utils';

const releaseStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean; label: string }
> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  planning: { color: 'info', pulse: true, label: '规划中' },
  migration_pre_running: { color: 'warning', pulse: true, label: '前置迁移' },
  migration_pre_failed: { color: 'error', pulse: false, label: '前置迁移失败' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  verifying: { color: 'info', pulse: true, label: '校验中' },
  migration_post_running: { color: 'warning', pulse: true, label: '后置迁移' },
  degraded: { color: 'warning', pulse: false, label: '降级' },
  succeeded: { color: 'success', pulse: false, label: '成功' },
  failed: { color: 'error', pulse: false, label: '失败' },
  canceled: { color: 'neutral', pulse: false, label: '已取消' },
};

const deploymentStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean; label: string }
> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  building: { color: 'info', pulse: true, label: '构建中' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  running: { color: 'success', pulse: false, label: '运行中' },
  failed: { color: 'error', pulse: false, label: '失败' },
  rolled_back: { color: 'warning', pulse: false, label: '已回滚' },
};

const migrationStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean }
> = {
  queued: { color: 'neutral', pulse: false },
  awaiting_approval: { color: 'warning', pulse: false },
  planning: { color: 'info', pulse: true },
  running: { color: 'info', pulse: true },
  success: { color: 'success', pulse: false },
  failed: { color: 'error', pulse: false },
  canceled: { color: 'neutral', pulse: false },
  skipped: { color: 'neutral', pulse: false },
};

function formatMigrationStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    awaiting_approval: '待审批',
    queued: '排队中',
    planning: '规划中',
    running: '执行中',
    success: '成功',
    failed: '失败',
    canceled: '已取消',
    skipped: '已跳过',
  };

  return labels[value] ?? value.replaceAll('_', ' ');
}

interface Environment {
  id: string;
  name: string;
  autoDeploy: boolean;
  isProduction: boolean;
}

interface ReleaseRecord {
  id: string;
  status: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  triggeredBy: string;
  environment: {
    id: string;
    name: string;
    isProduction: boolean;
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
    createdAt: string;
    serviceId: string | null;
  }>;
  migrationRuns: Array<{
    id: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    service: {
      id: string;
      name: string;
    } | null;
    database: {
      id: string;
      name: string;
    };
  }>;
}

function formatImageLabel(imageUrl: string): string {
  const imageName = imageUrl.split('/').pop() ?? imageUrl;
  const [repository, tag] = imageName.split(':');
  if (!tag) return repository;
  return `${repository}:${tag}`;
}

function getDeploymentStatusConfig(status: string) {
  return deploymentStatusConfig[status] || deploymentStatusConfig.queued;
}

interface ReleasesPageClientProps {
  projectId: string;
}

export function ReleasesPageClient({ projectId }: ReleasesPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const envFilter = searchParams.get('env');
  const filter = envFilter || 'all';
  const riskQuery = searchParams.get('risk');
  const riskFilter: 'all' | 'attention' | 'approval' | 'failed' =
    riskQuery === 'attention' || riskQuery === 'approval' || riskQuery === 'failed'
      ? riskQuery
      : 'all';

  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());

  const loadReleases = useCallback(async () => {
    if (!projectId) return;
    const response = await fetch(`/api/projects/${projectId}/releases`);
    if (!response.ok) return;
    const data = await response.json();
    setReleases(Array.isArray(data) ? data : []);
  }, [projectId]);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/environments`)
      .then((response) => response.json())
      .then((data) => setEnvironments(Array.isArray(data) ? data : []));
  }, [projectId]);

  const { isConnected, error } = useReleases({
    projectId,
    onRelease: () => loadReleases(),
  });

  const handlePromote = async () => {
    if (promoting) return;
    setPromoting(true);
    setPromoteResult(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/promote`, { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setPromoteResult(data.tagName ? `已创建生产发布 · ${data.tagName}` : '已创建生产发布');
        await loadReleases();
      } else {
        setPromoteResult(`错误：${data.error}`);
      }
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

  const envNames = ['all', ...new Set(releases.map((release) => release.environment.name))];
  const envFiltered =
    filter === 'all' ? releases : releases.filter((release) => release.environment.name === filter);
  const filtered = envFiltered.filter((release) => {
    if (riskFilter === 'all') return true;

    const hasApproval = release.migrationRuns.some((run) => run.status === 'awaiting_approval');
    const hasFailedMigration = release.migrationRuns.some((run) => run.status === 'failed');
    const hasAttention =
      hasApproval ||
      hasFailedMigration ||
      ['migration_pre_failed', 'failed', 'degraded'].includes(release.status);

    if (riskFilter === 'attention') return hasAttention;
    if (riskFilter === 'approval') return hasApproval;
    if (riskFilter === 'failed')
      return hasFailedMigration || ['failed', 'migration_pre_failed'].includes(release.status);
    return true;
  });

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
  const hasStagingProdSplit = environments.some((environment) => environment.isProduction);
  const canPromote = hasStagingProdSplit && !!latestStagingRelease;

  const stats = [
    { label: '发布', value: filtered.length },
    {
      label: '待审批',
      value: filtered.filter((release) =>
        release.migrationRuns.some((run) => run.status === 'awaiting_approval')
      ).length,
    },
    {
      label: '失败',
      value: filtered.filter((release) =>
        release.migrationRuns.some((run) => run.status === 'failed')
      ).length,
    },
    {
      label: '实时',
      value: isConnected ? '在线' : '离线',
    },
  ];

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
            {hasStagingProdSplit && (
              <Button
                size="sm"
                className="h-9 rounded-xl px-4"
                onClick={handlePromote}
                disabled={promoting || !canPromote}
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
          {envNames.map((env) => (
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
            const config = releaseStatusConfig[release.status] || releaseStatusConfig.queued;
            const expanded = expandedReleases.has(release.id);
            const failedMigrations = release.migrationRuns.filter(
              (run) => run.status === 'failed'
            ).length;
            const approvalCount = release.migrationRuns.filter(
              (run) => run.status === 'awaiting_approval'
            ).length;

            return (
              <div key={release.id} className="console-panel overflow-hidden">
                <div className="flex">
                  <div
                    className={cn(
                      'w-1 shrink-0 self-stretch',
                      config.color === 'success'
                        ? 'bg-success'
                        : config.color === 'warning'
                          ? 'bg-warning'
                          : config.color === 'error'
                            ? 'bg-destructive'
                            : config.color === 'info'
                              ? 'bg-info'
                              : 'bg-muted-foreground/30'
                    )}
                  />
                  <div className="min-w-0 flex-1 px-5 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusIndicator
                            status={config.color}
                            pulse={config.pulse}
                            label={config.label}
                          />
                          <Badge
                            variant={release.environment.isProduction ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {release.environment.name}
                          </Badge>
                          <Badge variant="outline">{release.artifacts.length} 个服务</Badge>
                          <Badge variant="outline" className="capitalize">
                            {release.triggeredBy}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="text-base font-semibold">
                            {release.summary || '未命名发布'}
                          </div>
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

                        {(release.errorMessage || failedMigrations > 0 || approvalCount > 0) && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {release.errorMessage && (
                              <span className="rounded-full border border-destructive/15 bg-background px-2.5 py-1 text-destructive">
                                {release.errorMessage}
                              </span>
                            )}
                            {failedMigrations > 0 && (
                              <span className="rounded-full border border-destructive/15 bg-background px-2.5 py-1 text-destructive">
                                {failedMigrations} 个失败迁移
                              </span>
                            )}
                            {approvalCount > 0 && (
                              <span className="rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-foreground">
                                {approvalCount} 个待审批
                              </span>
                            )}
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
                              {release.deployments.map((deployment) => {
                                const deploymentConfig = getDeploymentStatusConfig(
                                  deployment.status
                                );
                                const serviceLabel = deployment.serviceId
                                  ? release.artifacts.find(
                                      (artifact) => artifact.service.id === deployment.serviceId
                                    )?.service.name
                                  : '项目';

                                return (
                                  <div
                                    key={deployment.id}
                                    className="rounded-2xl border border-border bg-background px-4 py-3"
                                  >
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <StatusIndicator
                                        status={deploymentConfig.color}
                                        pulse={deploymentConfig.pulse}
                                        label={deploymentConfig.label}
                                      />
                                      <Badge variant="outline">{serviceLabel ?? '服务'}</Badge>
                                      {deployment.version && (
                                        <Badge variant="secondary">v{deployment.version}</Badge>
                                      )}
                                    </div>
                                    {deployment.imageUrl && (
                                      <div className="mb-3 break-all text-xs text-muted-foreground">
                                        {deployment.imageUrl}
                                      </div>
                                    )}
                                    <DeploymentLogs
                                      projectId={projectId}
                                      deploymentId={deployment.id}
                                      status={deployment.status}
                                    />
                                  </div>
                                );
                              })}
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
                              release.migrationRuns.map((run) => {
                                const migrationConfig =
                                  migrationStatusConfig[run.status] || migrationStatusConfig.queued;

                                return (
                                  <div
                                    key={run.id}
                                    className="rounded-2xl border border-border bg-background px-4 py-3"
                                  >
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <StatusIndicator
                                        status={migrationConfig.color}
                                        pulse={migrationConfig.pulse}
                                        label={formatMigrationStatusLabel(run.status)}
                                      />
                                      <Badge variant="outline">{run.database.name}</Badge>
                                    </div>
                                    <div className="text-sm font-medium">
                                      {run.service?.name ?? '服务'}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {new Date(run.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                );
                              })
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
