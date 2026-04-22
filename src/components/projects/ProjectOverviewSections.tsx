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
    getEnvironmentGitSummary(environment) ??
    environment.previewLifecycle?.summary ??
    environment.platformSignals.nextActionLabel ??
    null;

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
    <section className="overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]">
      <div className="console-divider-bottom px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">环境</div>
          <div className="text-xs text-muted-foreground">从这里进入具体环境处理后续事项</div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {environments.length === 0 ? (
          <div className="rounded-[18px] bg-[rgba(243,240,233,0.66)] px-5 py-8 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
            还没有环境
          </div>
        ) : (
          sortedEnvironments.map((environment) => (
            <Link
              key={environment.id}
              href={`/projects/${projectId}/environments/${environment.id}`}
              className="block rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset] transition-colors hover:bg-[rgba(243,240,233,0.82)]"
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
