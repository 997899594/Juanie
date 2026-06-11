import { ArrowRight, CheckCircle2, Database, Globe2, Server } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProjectPreviewEnvironmentLauncher } from '@/components/projects/ProjectPreviewEnvironmentLauncher';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { ProjectOverviewPageData } from '@/lib/projects/service';
import { getReleaseStatusDecoration } from '@/lib/releases/status-presentation';
import { formatPlatformRelativeTime } from '@/lib/time/format';

function getEnvironmentSummary(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string {
  const promotionSourceSummary = getEnvironmentPromotionSourceSummary(environment);

  return (
    promotionSourceSummary ??
    environment.platformSignals.primarySummary ??
    (environment.latestReleaseCard ? `版本 ${environment.latestReleaseCard.title}` : null) ??
    environment.previewLifecycle?.stateLabel ??
    environment.scopeLabel ??
    '进入环境'
  );
}

function getEnvironmentPromotionSourceSummary(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string | null {
  const sourceRelease = environment.latestReleaseCard?.sourceRelease;

  if (!sourceRelease) {
    return null;
  }

  return `从 ${sourceRelease.environmentName} · ${sourceRelease.title} 提升`;
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
  if (getEnvironmentPromotionSourceSummary(environment) && environment.latestReleaseCard) {
    return `当前版本 ${environment.latestReleaseCard.title}`;
  }

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
  governance,
  initialCreateOpen,
}: {
  projectId: string;
  environments: ProjectOverviewPageData['environmentCards'];
  governance: ProjectOverviewPageData['previewEnvironmentActions'];
  initialCreateOpen?: boolean;
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
          <div>
            <div className="text-sm font-semibold">环境状态</div>
            <div className="mt-1 text-xs text-muted-foreground">
              当前版本、来源和下一步操作集中在这里判断。
            </div>
          </div>
          <ProjectPreviewEnvironmentLauncher
            projectId={projectId}
            governance={governance}
            initialOpen={initialCreateOpen}
          />
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {environments.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">还没有环境</div>
        ) : (
          sortedEnvironments.map((environment) => (
            <Link
              key={environment.id}
              href={`/projects/${projectId}/environments/${environment.id}`}
              className="block px-5 py-4 transition-colors hover:bg-foreground/[0.035]"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.75fr)_minmax(0,1.25fr)_auto] lg:items-center">
                <div className="min-w-0 space-y-2">
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
                  <div className="text-xs text-muted-foreground">
                    {environment.scopeLabel ?? environment.sourceLabel ?? '环境'}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">
                    {getEnvironmentSummary(environment)}
                  </div>
                  {getEnvironmentSecondaryLine(environment) ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {getEnvironmentSecondaryLine(environment)}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground lg:justify-end">
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

export function ProjectOverviewFacts({ stats }: { stats: ProjectOverviewPageData['stats'] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="console-inset px-3 py-3">
          <div className="text-xs text-muted-foreground">{stat.label}</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectAttentionQueue({
  projectId,
  items,
}: {
  projectId: string;
  items: ProjectOverviewPageData['attentionItems'];
}) {
  const visibleItems = items.slice(0, 6);

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">需要处理</div>
            <div className="mt-1 text-xs text-muted-foreground">只放需要人判断或点击的事项。</div>
          </div>
          {items.length > 0 ? (
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
              {items.length}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {visibleItems.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-[14px] bg-success/[0.06] px-5 py-8 text-center">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="mt-3 text-sm font-medium text-foreground">没有待处理事项</div>
            <div className="mt-1 text-xs text-muted-foreground">
              发布、迁移和环境治理都没有卡点。
            </div>
          </div>
        ) : (
          visibleItems.map((item) => {
            const environmentId =
              item.environment &&
              'id' in item.environment &&
              typeof item.environment.id === 'string'
                ? item.environment.id
                : null;
            const href =
              item.releaseId && environmentId
                ? `/projects/${projectId}/environments/${environmentId}/delivery/${item.releaseId}`
                : environmentId
                  ? `/projects/${projectId}/environments/${environmentId}`
                  : `/projects/${projectId}`;

            return (
              <Link
                key={item.id ?? `${item.releaseId}:${item.status}`}
                href={href}
                className="console-inset block px-4 py-3 transition-colors hover:bg-white/90"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {item.environment?.name ?? item.environmentScopeLabel ?? '环境'}
                      </Badge>
                      {item.issueLabel ? (
                        <span className="text-xs font-medium text-foreground">
                          {item.issueLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {item.releaseTitle ?? item.database?.name ?? '待处理事项'}
                    </div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {item.actionLabel ?? item.platformSignals.nextActionLabel ?? '查看并处理'}
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

function buildDatabaseSnapshotItems(databases: ProjectOverviewPageData['databaseCards']) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      environmentNames: Set<string>;
      serviceNames: Set<string>;
      migrationStatuses: Set<string>;
      releaseTitles: Set<string>;
    }
  >();

  for (const database of databases) {
    const label = database.name ?? database.type ?? '数据库';
    const key = [label, database.type ?? 'database', database.serviceName ?? 'project'].join(':');
    const group = groups.get(key) ?? {
      key,
      label,
      environmentNames: new Set<string>(),
      serviceNames: new Set<string>(),
      migrationStatuses: new Set<string>(),
      releaseTitles: new Set<string>(),
    };

    if (database.environmentName) {
      group.environmentNames.add(database.environmentName);
    }
    if (database.serviceName) {
      group.serviceNames.add(database.serviceName);
    }
    if (database.latestMigration?.status) {
      group.migrationStatuses.add(database.latestMigration.status);
    }
    if (database.latestRelease?.title) {
      group.releaseTitles.add(database.latestRelease.title);
    }

    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    const environmentNames = Array.from(group.environmentNames);
    const migrationStatuses = Array.from(group.migrationStatuses);
    const releaseTitles = Array.from(group.releaseTitles);

    return {
      key: group.key,
      label: group.label,
      meta: [
        environmentNames.length > 0
          ? `${environmentNames.join(' / ')} · ${environmentNames.length} 个环境`
          : null,
        group.serviceNames.size > 0 ? `服务 ${Array.from(group.serviceNames).join(' / ')}` : null,
        migrationStatuses.length > 0 ? `迁移 ${migrationStatuses.join(' / ')}` : null,
        releaseTitles.length === 1 ? releaseTitles[0] : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });
}

export function ProjectRuntimeSnapshot({
  services,
  databases,
  domains,
}: {
  services: ProjectOverviewPageData['serviceCards'];
  databases: ProjectOverviewPageData['databaseCards'];
  domains: ProjectOverviewPageData['domainCards'];
}) {
  const visibleServices = services.slice(0, 3);
  const visibleDatabases = buildDatabaseSnapshotItems(databases).slice(0, 3);
  const visibleDomains = domains.slice(0, 3);

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="text-sm font-semibold">运行资产</div>
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
          title="数据库"
          empty="还没有数据库"
          items={visibleDatabases}
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
        <div className="text-sm font-semibold">最近发布</div>
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
