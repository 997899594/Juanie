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
  currentRelease: ProjectOverviewPageData['recentReleaseCards'][number] | null;
  primaryAttention: ProjectOverviewPageData['attentionItems'][number] | null;
  commandCenter: ProjectCommandCenterSnapshot;
}

export function ProjectOverviewHero({
  currentRelease,
  primaryAttention,
  commandCenter,
}: ProjectOverviewHeroProps) {
  return (
    <section className="console-panel px-5 py-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {commandCenter.title}
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild size="sm" className="h-10 rounded-xl px-4">
              <Link href={commandCenter.primaryAction.href}>
                {commandCenter.primaryAction.label}
              </Link>
            </Button>
            {commandCenter.secondaryAction ? (
              <Button asChild variant="outline" size="sm" className="h-10 rounded-xl px-4">
                <Link href={commandCenter.secondaryAction.href}>
                  {commandCenter.secondaryAction.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="console-surface flex items-center rounded-[20px] px-4 py-4">
          <div className="text-sm font-medium">{commandCenter.primaryAction.label}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="console-stat px-4 py-3">
          <div className="text-xs text-muted-foreground">发布</div>
          <div className="mt-2 line-clamp-2 text-sm font-medium">
            {currentRelease?.title ?? '还没有发布'}
          </div>
        </div>
        <div className="console-stat px-4 py-3">
          <div className="text-xs text-muted-foreground">待处理</div>
          <div className="mt-2 line-clamp-2 text-sm font-medium">
            {primaryAttention?.issueLabel ?? '当前无阻塞项'}
          </div>
        </div>
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

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="console-surface inline-flex items-center gap-2 rounded-full px-3 py-1.5">
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
              {services.slice(0, 4).map((service) => (
                <div
                  key={service.id}
                  className="console-surface inline-flex items-center gap-2 rounded-full px-3 py-1.5"
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
              <Link href={`/projects/${projectId}/runtime`}>运行</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
              <Link href={`/projects/${projectId}/delivery`}>交付</Link>
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
              {attentionItems.slice(0, 3).map((run) => (
                <Link
                  key={run.id}
                  href={
                    run.releaseId
                      ? `/projects/${projectId}/delivery/${run.releaseId}`
                      : `/projects/${projectId}/delivery`
                  }
                  className="console-surface flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusDotClass(run.status, 'migration')}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {run.releaseTitle ?? run.issueLabel ?? run.database?.name ?? '待处理项'}
                      </div>
                      <div className="mt-1 truncate text-sm text-foreground">
                        {run.platformSignals.primarySummary ??
                          (run.platformSignals.nextActionLabel || run.actionLabel
                            ? (run.platformSignals.nextActionLabel ?? run.actionLabel)
                            : '处理')}
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
            recentReleaseCards.slice(0, 3).map((release) => (
              <Link
                key={release.id}
                href={`/projects/${projectId}/delivery/${release.id}`}
                className="console-surface flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/40"
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
                        ? release.platformSignals.nextActionLabel
                        : (release.sourceSummary ?? '详情'))}
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
