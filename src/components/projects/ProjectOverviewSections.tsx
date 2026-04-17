import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

function getEnvironmentSummary(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string {
  return (
    (environment.isProduction && environment.primaryDomainUrl
      ? environment.primaryDomainUrl.replace(/^https?:\/\//, '')
      : null) ??
    environment.platformSignals.primarySummary ??
    (environment.latestReleaseCard ? `当前版本 ${environment.latestReleaseCard.title}` : null) ??
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
    return `Git 追踪待建立 · ${environment.gitTracking.trackingBranchName}`;
  }

  if (environment.gitTracking.expectsPromotionTag) {
    return [
      environment.gitTracking.shortCommitSha
        ? `当前追踪 ${environment.gitTracking.shortCommitSha}`
        : null,
      environment.gitTracking.releaseTagName ? '已生成提升标签' : '等待提升标签',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return environment.gitTracking.shortCommitSha
    ? `当前追踪 ${environment.gitTracking.shortCommitSha}`
    : `Git ${environment.gitTracking.trackingBranchName}`;
}

function getEnvironmentSecondaryLine(
  environment: ProjectOverviewPageData['environmentCards'][number]
): string | null {
  return (
    getEnvironmentGitSummary(environment) ??
    environment.previewLifecycle?.summary ??
    environment.platformSignals.nextActionLabel ??
    null
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
        <div className="text-sm font-semibold">环境</div>
      </div>

      <div className="space-y-3 p-3">
        {environments.length === 0 ? (
          <div className="ui-control-muted px-5 py-8 text-sm text-muted-foreground">还没有环境</div>
        ) : (
          environments.map((environment) => (
            <Link
              key={environment.id}
              href={`/projects/${projectId}/environments/${environment.id}`}
              className="ui-control block px-4 py-4 transition-colors hover:bg-secondary/55"
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
                      <Badge variant="outline">
                        {environment.latestReleaseCard.statusDecoration.label}
                      </Badge>
                    ) : null}
                    {environment.previewLifecycle ? (
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
