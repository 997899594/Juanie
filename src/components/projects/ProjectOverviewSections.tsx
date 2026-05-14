import { ArrowRight, Database, Globe2, Plus, Server } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { ProjectOverviewPageData } from '@/lib/projects/service';
import { getReleaseStatusDecoration } from '@/lib/releases/status-presentation';
import { formatPlatformRelativeTime } from '@/lib/time/format';

function getEnvironmentSummary(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string {
  return (
    (environment.isProduction && environment.primaryDomainUrl
      ? environment.primaryDomainUrl.replace(/^https?:\/\//, '')
      : null) ??
    environment.platformSignals.primarySummary ??
    (environment.latestReleaseCard ? `版本 ${environment.latestReleaseCard.title}` : null) ??
    environment.previewLifecycle?.stateLabel ??
    environment.scopeLabel ??
    '进入环境'
  );
}

function getEnvironmentGitSummary(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string | null {
  if (!environment.gitTracking) {
    return null;
  }

  if (environment.gitTracking.state === 'pending') {
    return environment.gitTracking.summary;
  }

  if (environment.gitTracking.expectsPromotionTag) {
    return [
      environment.gitTracking.shortCommitSha
        ? `追踪 ${environment.gitTracking.shortCommitSha}`
        : null,
      environment.gitTracking.releaseTagName ? '已生成提升标签' : '等待提升标签',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return environment.gitTracking.shortCommitSha
    ? `追踪 ${environment.gitTracking.shortCommitSha}`
    : `Git ${environment.gitTracking.trackingBranchName}`;
}

function getEnvironmentSecondaryLine(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string | null {
  const secondary =
    getEnvironmentGitSummary(environment) ?? environment.previewLifecycle?.summary ?? null;

  if (!secondary || secondary === getEnvironmentSummary(environment)) {
    return null;
  }

  return secondary;
}

export function ProjectEnvironmentIndex({
  projectId,
  environments,
}: {
  projectId: string;
  environments: ProjectOverviewPageData['environmentCards'];
}) {
  const sortedEnvironments = [...environments].sort((left, right) => {
    const leftPriority = left.isProduction ? 0 : left.isPreview ? 2 : 1;
    const rightPriority = right.isProduction ? 0 : right.isPreview ? 2 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">环境</div>
          <Button asChild size="sm" className="h-8 rounded-full px-3">
            <Link href={`/projects/${projectId}/environments?new=preview`}>
              <Plus className="h-3.5 w-3.5" />
              新建预览
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {environments.length === 0 ? (
          <div className="console-inset px-5 py-8 text-sm text-muted-foreground">还没有环境</div>
        ) : (
          sortedEnvironments.map((environment) => (
            <Link
              key={environment.id}
              href={`/projects/${projectId}/environments/${environment.id}`}
              className="console-inset block px-4 py-4 transition-colors hover:bg-white/90"
            >
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
                      <Badge variant="secondary">
                        {environment.latestReleaseCard.statusDecoration.label}
                      </Badge>
                    ) : environment.previewLifecycle ? (
                      <Badge variant="secondary">{environment.previewLifecycle.stateLabel}</Badge>
                    ) : null}
                  </div>

                  <div className="truncate text-sm text-foreground">
                    {getEnvironmentSummary(environment)}
                  </div>
                  {getEnvironmentSecondaryLine(environment) ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {getEnvironmentSecondaryLine(environment)}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground xl:justify-end">
                  <span>进入环境</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export function ProjectOverviewStats({ stats }: { stats: ProjectOverviewPageData['stats'] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {stat.label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {stat.value}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProjectRuntimeSnapshot({
  projectId,
  services,
  databases,
  domains,
}: {
  projectId: string;
  services: ProjectOverviewPageData['serviceCards'];
  databases: ProjectOverviewPageData['databaseCards'];
  domains: ProjectOverviewPageData['domainCards'];
}) {
  const visibleServices = services.slice(0, 3);
  const visibleDatabases = databases.slice(0, 3);
  const visibleDomains = domains.slice(0, 3);

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">运行资产</div>
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
            <Link href={`/projects/${projectId}/environments`}>查看环境</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <SnapshotGroup
          icon={<Server className="h-4 w-4" />}
          title="服务"
          empty="还没有服务"
          items={visibleServices.map((service) => ({
            key: service.id,
            label: service.name,
            meta: [service.type, service.portLabel, service.statusLabel]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
        <SnapshotGroup
          icon={<Database className="h-4 w-4" />}
          title="数据"
          empty="还没有数据库"
          items={visibleDatabases.map((database) => ({
            key: database.id,
            label: database.name ?? database.type ?? '数据库',
            meta: [
              database.serviceName ? `服务 ${database.serviceName}` : null,
              database.latestMigration ? `迁移 ${database.latestMigration.status}` : null,
              database.latestRelease?.title ?? null,
            ]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
        <SnapshotGroup
          icon={<Globe2 className="h-4 w-4" />}
          title="域名"
          empty="还没有域名"
          items={visibleDomains.map((domain) => ({
            key: domain.id ?? domain.hostname,
            label: domain.hostname,
            meta: domain.url,
          }))}
        />
      </div>
    </section>
  );
}

export function ProjectRecentReleaseSnapshot({
  projectId,
  releases,
}: {
  projectId: string;
  releases: ProjectOverviewPageData['recentReleaseCards'];
}) {
  const visibleReleases = releases.slice(0, 5);

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">最近发布</div>
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
            <Link href={`/projects/${projectId}/environments`}>全部发布</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {visibleReleases.length === 0 ? (
          <div className="console-inset px-5 py-8 text-sm text-muted-foreground">
            还没有发布记录
          </div>
        ) : (
          visibleReleases.map((release) => {
            const status = getReleaseStatusDecoration(release.status ?? 'queued');
            const href = `/projects/${projectId}/environments/${release.environment.id}/delivery/${release.id}`;

            return (
              <Link
                key={release.id}
                href={href}
                className="console-inset block px-4 py-3 transition-colors hover:bg-white/90"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={status.color}
                        pulse={status.pulse}
                        label={status.label}
                      />
                      <Badge variant="secondary">{release.environment.name ?? '环境'}</Badge>
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {release.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[
                        release.shortCommitSha,
                        release.previewSourceMeta.label,
                        formatPlatformRelativeTime(release.createdAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function SnapshotGroup({
  icon,
  title,
  empty,
  items,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  items: Array<{ key: string; label: string; meta: string | null }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="console-inset px-4 py-3 text-sm text-muted-foreground">{empty}</div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="console-inset px-4 py-3">
              <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
              {item.meta ? (
                <div className="mt-1 truncate text-xs text-muted-foreground">{item.meta}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
