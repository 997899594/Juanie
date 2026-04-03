import { AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectCommandCenterSnapshot } from '@/lib/projects/overview-command-center';
import type { ProjectOverviewPageData } from '@/lib/projects/service';
import { getStatusDotClass } from '@/lib/releases/status-presentation';
import { getRuntimeStatusDotClass } from '@/lib/runtime/status-presentation';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ProjectOverviewHeroProps {
  stats: ProjectOverviewPageData['stats'];
  currentRelease: ProjectOverviewPageData['recentReleaseCards'][number] | null;
  primaryAttention: ProjectOverviewPageData['attentionItems'][number] | null;
  commandCenter: ProjectCommandCenterSnapshot;
}

export function ProjectOverviewHero({
  stats,
  currentRelease,
  primaryAttention,
  commandCenter,
}: ProjectOverviewHeroProps) {
  return (
    <section className="console-panel px-5 py-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {commandCenter.eyebrow}
      </div>
      <div className="mt-4">
        <h2 className="text-2xl font-semibold tracking-tight">{commandCenter.title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {commandCenter.summary}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild size="sm" className="h-10 rounded-xl px-4">
          <Link href={commandCenter.primaryAction.href}>{commandCenter.primaryAction.label}</Link>
        </Button>
        {commandCenter.secondaryAction ? (
          <Button asChild variant="outline" size="sm" className="h-10 rounded-xl px-4">
            <Link href={commandCenter.secondaryAction.href}>
              {commandCenter.secondaryAction.label}
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
          <div className="text-xs text-muted-foreground">当前发布</div>
          <div className="mt-2 line-clamp-2 text-sm font-medium">
            {currentRelease?.title ?? '还没有发布'}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
          <div className="text-xs text-muted-foreground">待处理</div>
          <div className="mt-2 line-clamp-2 text-sm font-medium">
            {primaryAttention?.issueLabel ?? '当前无阻塞项'}
          </div>
        </div>
        {stats.slice(0, 2).map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-background px-4 py-3"
          >
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="mt-2 text-xl font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectEnvironmentEntrySection({
  projectId,
  environments,
}: {
  projectId: string;
  environments: ProjectOverviewPageData['environmentCards'];
}) {
  if (environments.length === 0) {
    return null;
  }

  return (
    <section className="console-panel px-5 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">环境入口</div>
          <div className="mt-1 text-sm text-muted-foreground">
            先选环境，再进入对应发布与执行详情。
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
          <Link href={`/projects/${projectId}/environments`}>打开环境列表</Link>
        </Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {environments.map((environment) => (
          <div key={environment.id} className="console-card bg-secondary/20 px-4 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  environment.primaryDomainUrl ? 'bg-success' : 'bg-warning'
                }`}
              />
              <span className="text-sm font-medium">{environment.name}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {[
                environment.isProduction ? '生产' : null,
                environment.scopeLabel,
                environment.sourceLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {environment.platformSignals.primarySummary ??
                '进入环境查看当前 live release 与最近发布。'}
            </div>
            {environment.primaryDomainUrl ? (
              <a
                href={environment.primaryDomainUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-foreground underline underline-offset-4"
              >
                打开访问地址
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {environment.latestReleaseCard && (
              <div className="mt-3 rounded-2xl border border-border bg-background px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  最近发布
                </div>
                <div className="mt-1 text-sm font-medium">
                  {environment.latestReleaseCard.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {environment.latestReleaseCard.createdAtLabel ?? '最近发布'}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {environment.latestReleaseCard ? (
                <Button asChild size="sm" className="h-8 rounded-xl px-3">
                  <Link
                    href={`/projects/${projectId}/releases/${environment.latestReleaseCard.id}`}
                  >
                    打开发布
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="h-8 rounded-xl px-3">
                  <Link href={`/projects/${projectId}/releases?env=${environment.id}`}>
                    进入发布
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
                <Link href={`/projects/${projectId}/environments?env=${environment.id}`}>
                  打开环境
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectDefinitionSection({
  project,
  overview,
  services,
}: {
  project: ProjectOverviewPageData['project'];
  overview: ProjectOverviewPageData['overview'];
  services: ProjectOverviewPageData['serviceCards'];
}) {
  return (
    <section className="console-panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="text-sm font-semibold">项目定义</div>
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

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/20 px-3 py-1.5">
            <div className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(project.status)}`} />
            <span className="font-medium capitalize">{overview.statusLabel}</span>
          </div>
          <div className="text-muted-foreground">{overview.createdDateLabel}</div>
        </div>

        {services.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              服务模型
            </div>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/20 px-3 py-1.5"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(service.status)}`}
                  />
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{service.type}</span>
                  {service.portLabel && (
                    <span className="text-xs text-muted-foreground">{service.portLabel}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ProjectOperationsSection({
  projectId,
  attentionItems,
  recentReleaseCards,
}: {
  projectId: string;
  attentionItems: ProjectOverviewPageData['attentionItems'];
  recentReleaseCards: ProjectOverviewPageData['recentReleaseCards'];
}) {
  return (
    <section className="console-panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">项目动态</div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
              <Link href={`/projects/${projectId}/environments`}>环境列表</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
              <Link href={`/projects/${projectId}/releases`}>发布列表</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-3">
        <div className="space-y-2">
          <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            待处理
          </div>
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
                      ? `/projects/${projectId}/releases/${run.releaseId}`
                      : `/projects/${projectId}/releases`
                  }
                  className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusDotClass(run.status, 'migration')}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {run.releaseTitle ?? run.issueLabel ?? run.database?.name ?? '待处理项'}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        {[
                          run.service?.name ?? null,
                          run.database?.name ?? null,
                          run.environmentScopeLabel,
                          run.environmentSourceLabel,
                          run.previewSourceMeta.label,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="mt-1 truncate text-sm text-foreground">
                        {run.platformSignals.primarySummary ??
                          (run.platformSignals.nextActionLabel || run.actionLabel
                            ? `下一步：${run.platformSignals.nextActionLabel ?? run.actionLabel}`
                            : '进入后继续处理当前执行项')}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPlatformDateTime(run.createdAt, { includeYear: false }) ?? '—'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            最近发布
          </div>
          {recentReleaseCards.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
              还没有发布
            </div>
          ) : (
            recentReleaseCards.slice(0, 5).map((release) => (
              <Link
                key={release.id}
                href={`/projects/${projectId}/releases/${release.id}`}
                className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusDotClass(release.status ?? '', 'release')}`}
                    />
                    <span className="truncate text-sm font-medium">{release.title}</span>
                    <Badge variant="secondary" className="capitalize">
                      {release.environment.name ?? '环境'}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {release.platformSignals.primarySummary ??
                      (release.platformSignals.nextActionLabel
                        ? `下一步：${release.platformSignals.nextActionLabel}`
                        : (release.sourceSummary ?? '打开发布查看详情'))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPlatformDateTime(release.createdAt, { includeYear: false }) ?? '—'}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
