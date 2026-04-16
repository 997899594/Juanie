import { AlertTriangle, ArrowRight, ExternalLink, GitBranch, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectCommandCenterSnapshot } from '@/lib/projects/overview-command-center';
import type { ProjectOverviewPageData } from '@/lib/projects/service';
import { getStatusDotClass } from '@/lib/releases/status-presentation';
import { getRuntimeStatusDotClass } from '@/lib/runtime/status-presentation';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ProjectOverviewHeroProps {
  commandCenter: ProjectCommandCenterSnapshot;
  projectStatusLabel: string;
  projectStatus: string | null;
}

export function ProjectOverviewHero({
  commandCenter,
  projectStatusLabel,
  projectStatus,
}: ProjectOverviewHeroProps) {
  return (
    <section className="ui-floating px-5 py-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {commandCenter.eyebrow}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {commandCenter.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {commandCenter.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm" className="h-10 px-4">
              <Link href={commandCenter.primaryAction.href}>
                {commandCenter.primaryAction.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {commandCenter.secondaryAction ? (
              <Button asChild variant="outline" size="sm" className="h-10 px-4">
                <Link href={commandCenter.secondaryAction.href}>
                  {commandCenter.secondaryAction.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="ui-control-muted rounded-[22px] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            当前状态
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-medium">
            <span className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(projectStatus)}`} />
            <span>{projectStatusLabel}</span>
          </div>
          {commandCenter.primaryAction.description ? (
            <div className="mt-3 text-sm text-muted-foreground">
              {commandCenter.primaryAction.description}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectDefinitionSection({
  project,
  overview,
  services,
  productionEnvironment,
}: {
  project: ProjectOverviewPageData['project'];
  overview: ProjectOverviewPageData['overview'];
  services: ProjectOverviewPageData['serviceCards'];
  productionEnvironment: ProjectOverviewPageData['environmentCards'][number] | null;
}) {
  return (
    <section className="ui-floating overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="text-sm font-semibold">项目摘要</div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="ui-control-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(project.status)}`} />
            <span className="font-medium capitalize">{overview.statusLabel}</span>
          </div>
          <div className="text-muted-foreground">{overview.createdDateLabel}</div>
        </div>

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
              主分支
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-1.5 text-sm">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono">{overview.productionBranch}</span>
            </div>
          </div>
        )}

        {productionEnvironment?.primaryDomainUrl ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              正式环境地址
            </div>
            <a
              href={productionEnvironment.primaryDomainUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              {productionEnvironment.primaryDomainUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="ui-control-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{services.length} 个服务</span>
          </div>
          {productionEnvironment ? (
            <div className="text-muted-foreground">{productionEnvironment.name} 为正式环境</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectEnvironmentIndex({
  projectId,
  environments,
}: {
  projectId: string;
  environments: ProjectOverviewPageData['environmentCards'];
}) {
  return (
    <section className="ui-floating overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">环境</div>
          <Button asChild variant="outline" size="sm" className="h-8 px-3">
            <Link href={`/projects/${projectId}/environments`}>查看全部</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {environments.length === 0 ? (
          <div className="ui-control-muted rounded-[20px] px-5 py-8 text-sm text-muted-foreground">
            还没有环境
          </div>
        ) : (
          environments.map((environment) => (
            <div key={environment.id} className="ui-control rounded-[22px] px-4 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        environment.isPreview
                          ? 'bg-info'
                          : environment.isProduction
                            ? 'bg-success'
                            : 'bg-warning'
                      }`}
                    />
                    <div className="text-sm font-semibold">{environment.name}</div>
                    {environment.latestReleaseCard ? (
                      <Badge variant="outline">
                        {environment.latestReleaseCard.statusDecoration.label}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {[
                      environment.latestReleaseCard
                        ? `当前版本 ${environment.latestReleaseCard.title}`
                        : null,
                      environment.scopeLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ') ||
                      environment.previewLifecycle?.stateLabel ||
                      '进入环境'}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                  <Button asChild variant="outline" size="sm" className="h-8 px-3">
                    <Link href={`/projects/${projectId}/environments/${environment.id}`}>
                      进入环境
                    </Link>
                  </Button>
                  {environment.isProduction && environment.primaryDomainUrl ? (
                    <Button asChild variant="outline" size="sm" className="h-8 px-3">
                      <a href={environment.primaryDomainUrl} target="_blank" rel="noreferrer">
                        地址
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function ProjectActivitySection({
  projectId,
  attentionItems,
  recentReleaseCards,
}: {
  projectId: string;
  attentionItems: ProjectOverviewPageData['attentionItems'];
  recentReleaseCards: ProjectOverviewPageData['recentReleaseCards'];
}) {
  return (
    <section className="ui-floating overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">动态</div>
          <Button asChild variant="outline" size="sm" className="h-8 px-3">
            <Link href={`/projects/${projectId}/delivery`}>查看交付</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-3">
        <div className="space-y-2">
          <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            待处理
          </div>
          {attentionItems.length === 0 ? (
            <div className="ui-control-muted flex min-h-36 flex-col items-center justify-center rounded-2xl p-6 text-center">
              <AlertTriangle className="mb-3 h-5 w-5 text-muted-foreground" />
              <div className="text-sm font-medium">没有阻塞项</div>
            </div>
          ) : (
            attentionItems.slice(0, 3).map((run) => (
              <Link
                key={run.id}
                href={
                  run.releaseId
                    ? `/projects/${projectId}/delivery/${run.releaseId}`
                    : `/projects/${projectId}/delivery`
                }
                className="ui-control rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/70"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${getStatusDotClass(run.status, 'migration')}`}
                      />
                      <div className="truncate text-sm font-medium">
                        {run.releaseTitle ?? run.issueLabel ?? run.database?.name ?? '待处理项'}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {run.platformSignals.primarySummary ??
                        run.platformSignals.nextActionLabel ??
                        run.actionLabel ??
                        '处理'}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPlatformDateTime(run.createdAt, { includeYear: false }) ?? '—'}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            最近发布
          </div>
          {recentReleaseCards.length === 0 ? (
            <div className="ui-control-muted flex min-h-32 items-center justify-center rounded-2xl text-sm text-muted-foreground">
              没有发布
            </div>
          ) : (
            recentReleaseCards.slice(0, 3).map((release) => (
              <Link
                key={release.id}
                href={`/projects/${projectId}/delivery/${release.id}`}
                className="ui-control rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/70"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${getStatusDotClass(release.status ?? '', 'release')}`}
                      />
                      <span className="truncate text-sm font-medium">{release.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{release.environment.name ?? '环境'}</span>
                      {release.platformSignals.primarySummary ? (
                        <span className="truncate">{release.platformSignals.primarySummary}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPlatformDateTime(release.createdAt, { includeYear: false }) ?? '—'}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
