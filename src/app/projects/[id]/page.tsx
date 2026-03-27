import {
  AlertTriangle,
  Box,
  Database,
  ExternalLink,
  Globe,
  Link2,
  Rocket,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DatabaseMigrationDialog } from '@/components/projects/DatabaseMigrationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewSourceSummary } from '@/components/ui/preview-source-summary';
import { auth } from '@/lib/auth';
import { getProjectOverviewPageData } from '@/lib/projects/service';

const navItems = [
  { title: '发布', href: 'releases', icon: Rocket },
  { title: '环境', href: 'environments', icon: Globe },
  { title: '资源', href: 'resources', icon: Box },
  { title: '设置', href: 'settings', icon: Settings },
];

const statusColors: Record<string, string> = {
  active: 'bg-success',
  running: 'bg-success',
  initializing: 'bg-warning',
  pending: 'bg-warning',
  failed: 'bg-destructive',
  archived: 'bg-muted-foreground',
};

const releaseStatusColors: Record<string, string> = {
  queued: 'bg-muted-foreground',
  planning: 'bg-info',
  migration_pre_running: 'bg-warning',
  migration_pre_failed: 'bg-destructive',
  deploying: 'bg-info',
  verifying: 'bg-info',
  migration_post_running: 'bg-warning',
  degraded: 'bg-warning',
  succeeded: 'bg-success',
  failed: 'bg-destructive',
  canceled: 'bg-muted-foreground',
};

function formatStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    active: '运行中',
    running: '运行中',
    initializing: '初始化中',
    pending: '待处理',
    failed: '失败',
    archived: '已归档',
    queued: '排队中',
    awaiting_approval: '待审批',
    planning: '规划中',
    success: '成功',
    canceled: '已取消',
  };
  return labels[value] ?? value;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectOverviewPageData(id, session.user.id);

  if (!pageData?.project) redirect('/projects');

  const {
    project,
    stats,
    overview,
    serviceCards,
    domainCards,
    attentionItems,
    databaseCards,
    recentReleaseCards,
  } = pageData;
  const currentRelease = recentReleaseCards[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={project.name}
        description={overview.headerDescription}
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
            <Link href={`/projects/${id}/settings`}>
              <Settings className="h-3.5 w-3.5" />
              设置
            </Link>
          </Button>
        }
      />

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

      {domainCards.length > 0 && (
        <div className="console-panel px-5 py-4">
          <div className="mb-3 text-sm font-semibold">域名</div>
          <div className="flex flex-wrap gap-2">
            {domainCards.map((domain) => (
              <a
                key={domain.id}
                href={domain.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm transition-colors hover:bg-secondary/70"
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {domain.hostname}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`/projects/${id}/${item.href}`}
              className="console-panel flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">{item.title}</span>
            </Link>
          );
        })}
      </div>

      {currentRelease && (
        <section className="console-panel px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold">当前发布</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${releaseStatusColors[currentRelease.status ?? ''] ?? 'bg-muted-foreground'}`}
                />
                <span className="text-sm font-medium">{currentRelease.title}</span>
                <Badge variant="secondary">{currentRelease.environment.name ?? '环境'}</Badge>
                {currentRelease.previewSourceMeta.label && (
                  <Badge variant="outline">{currentRelease.previewSourceMeta.label}</Badge>
                )}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {currentRelease.platformSignals.primarySummary ??
                  currentRelease.sourceSummary ??
                  '进入发布页查看这次发布的变更、时间线与执行结果'}
              </div>
              {currentRelease.platformSignals.nextActionLabel && (
                <div className="mt-1 text-xs text-muted-foreground">
                  下一步：{currentRelease.platformSignals.nextActionLabel}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {currentRelease.primaryDomainUrl && (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
                  <a href={currentRelease.primaryDomainUrl} target="_blank" rel="noreferrer">
                    打开环境
                  </a>
                </Button>
              )}
              <Button asChild size="sm" className="h-9 rounded-xl px-4">
                <Link href={`/projects/${id}/releases/${currentRelease.id}`}>打开发布</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">概览</div>
            </div>
            <div className="space-y-4 px-5 py-4">
              {overview.repository && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    仓库
                  </div>
                  <a
                    href={overview.repository.webUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    {overview.repository.fullName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {overview.productionBranch && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    生产分支
                  </div>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                    {overview.productionBranch}
                  </code>
                </div>
              )}

              {overview.description && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    描述
                  </div>
                  <div className="text-sm text-muted-foreground">{overview.description}</div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    状态
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium capitalize">
                    <div
                      className={`h-2 w-2 rounded-full ${statusColors[project.status ?? ''] ?? 'bg-muted-foreground'}`}
                    />
                    {overview.statusLabel}
                  </div>
                </div>
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    创建时间
                  </div>
                  <div className="mt-2 text-sm font-medium">{overview.createdDateLabel}</div>
                </div>
              </div>
            </div>
          </section>

          {serviceCards.length > 0 && (
            <section className="console-panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold">服务</div>
              </div>
              <div className="space-y-2 p-3">
                {serviceCards.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[svc.status ?? ''] ?? 'bg-muted-foreground'}`}
                      />
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="secondary" className="capitalize">
                        {svc.type}
                      </Badge>
                    </div>
                    {svc.portLabel && (
                      <span className="text-xs text-muted-foreground">{svc.portLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">待处理</div>
            </div>
            <div className="p-3">
              {attentionItems.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                  <AlertTriangle className="mb-3 h-5 w-5 text-muted-foreground" />
                  <div className="text-sm font-medium">当前没有待处理项</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {attentionItems.slice(0, 5).map((run) => (
                    <Link
                      key={run.id}
                      href={
                        run.releaseId
                          ? `/projects/${id}/releases/${run.releaseId}`
                          : `/projects/${id}/releases`
                      }
                      className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            run.status === 'awaiting_approval' ? 'bg-warning' : 'bg-destructive'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {run.releaseTitle ?? run.issueLabel ?? run.database?.name ?? '待处理项'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[run.service?.name ?? '服务', run.database?.name ?? '数据库'].join(
                              ' · '
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {run.environmentScopeLabel && (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                                {run.environmentScopeLabel}
                              </span>
                            )}
                            {run.environmentSourceLabel && (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                                {run.environmentSourceLabel}
                              </span>
                            )}
                            {run.previewSourceMeta.label && (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                                {run.previewSourceMeta.label}
                              </span>
                            )}
                            {run.environmentExpiryLabel && (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                                {run.environmentExpiryLabel}
                              </span>
                            )}
                          </div>
                          {run.platformSignals.primarySummary && (
                            <div className="mt-1 text-sm text-foreground">
                              {run.platformSignals.primarySummary}
                            </div>
                          )}
                          {(run.platformSignals.nextActionLabel || run.actionLabel) && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              下一步：{run.platformSignals.nextActionLabel ?? run.actionLabel}
                            </div>
                          )}
                          {(run.releaseTitle || run.primaryDomainUrl) && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {run.releaseTitle && <span>{run.releaseTitle}</span>}
                              {run.previewSourceMeta.label && (
                                <PreviewSourceSummary meta={run.previewSourceMeta} />
                              )}
                              <span className="text-foreground underline underline-offset-4">
                                {run.primaryDomainUrl ? '打开环境' : '打开发布'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(run.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {databaseCards.length > 0 && (
            <section className="console-panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold">数据库</div>
              </div>
              <div className="space-y-3 p-3">
                {databaseCards.map((dbItem) => {
                  return (
                    <div key={dbItem.id} className="console-card bg-secondary/20 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Database className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{dbItem.name}</span>
                            <Badge variant="secondary" className="capitalize">
                              {dbItem.type}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {formatStatusLabel(dbItem.status ?? 'pending')}
                            </Badge>
                            {dbItem.scope === 'service' && dbItem.serviceId && (
                              <Badge variant="outline">{dbItem.serviceName ?? '服务'}</Badge>
                            )}
                          </div>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              {dbItem.latestMigration
                                ? `最近迁移：${formatStatusLabel(dbItem.latestMigration.status)}`
                                : '暂无迁移记录'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {dbItem.manualControl.issueLabel && (
                                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                                  {dbItem.manualControl.issueLabel}
                                </span>
                              )}
                              {dbItem.manualControl.actionLabel && (
                                <span className="text-[11px] text-muted-foreground">
                                  下一步：{dbItem.manualControl.actionLabel}
                                </span>
                              )}
                            </div>
                            <div>{dbItem.manualControl.reason}</div>
                            {dbItem.latestRelease ? (
                              <Link
                                href={`/projects/${id}/releases/${dbItem.latestRelease.id}`}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                              >
                                <span>{dbItem.latestRelease.title}</span>
                                {dbItem.latestRelease.commitSha && (
                                  <code className="font-mono">
                                    {dbItem.latestRelease.commitSha.slice(0, 7)}
                                  </code>
                                )}
                              </Link>
                            ) : (
                              <div>暂无关联发布</div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <DatabaseMigrationDialog
                            projectId={id}
                            databaseId={dbItem.id}
                            databaseName={dbItem.name}
                            databaseType={dbItem.type}
                            disabled={!dbItem.manualMigrationAction.allowed}
                            disabledSummary={dbItem.manualMigrationAction.summary}
                            latestStatus={dbItem.status ?? null}
                            latestMigration={dbItem.latestMigration}
                            latestRelease={dbItem.latestRelease}
                            latestImageUrl={dbItem.latestImageUrl}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">最近发布</div>
            </div>
            <div className="space-y-2 p-3">
              {recentReleaseCards.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                  还没有发布
                </div>
              ) : (
                recentReleaseCards.slice(0, 5).map((release) => (
                  <Link
                    key={release.id}
                    href={`/projects/${id}/releases/${release.id}`}
                    className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${releaseStatusColors[release.status ?? ''] ?? 'bg-muted-foreground'}`}
                        />
                        <span className="truncate text-sm font-medium">{release.title}</span>
                        <Badge variant="secondary" className="capitalize">
                          {release.environment.name ?? '环境'}
                        </Badge>
                        {release.previewSourceMeta.label && (
                          <Badge variant="outline">{release.previewSourceMeta.label}</Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {release.platformSignals.primarySummary ??
                          release.sourceSummary ??
                          '查看这次发布的详情'}
                      </div>
                      {release.platformSignals.nextActionLabel && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          下一步：{release.platformSignals.nextActionLabel}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {release.createdAt ? new Date(release.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
