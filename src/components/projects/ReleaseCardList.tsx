'use client';

import { ArrowRight, Clock, GitBranch, GitCommit, Rocket } from 'lucide-react';
import Link from 'next/link';
import { ReleaseAIRefreshActions } from '@/components/projects/ReleaseAIRefreshActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PreviewSourceSummary } from '@/components/ui/preview-source-summary';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { getProjectReleasesPageData } from '@/lib/releases/service';
import { formatPlatformTimeContext } from '@/lib/time/format';
import { cn } from '@/lib/utils';

function formatImageLabel(imageUrl: string): string {
  const imageName = imageUrl.split('/').pop() ?? imageUrl;
  const [repository, tag] = imageName.split(':');
  if (!tag) return repository;
  return `${repository}:${tag}`;
}

interface ReleaseCardListProps {
  projectId: string;
  releases: Awaited<ReturnType<typeof getProjectReleasesPageData>>['filteredReleaseItems'];
}

export function ReleaseCardList({ projectId, releases }: ReleaseCardListProps) {
  if (releases.length === 0) {
    return <EmptyState icon={<Rocket className="h-12 w-12" />} title="没有发布" />;
  }

  return (
    <div className="space-y-3">
      {releases.map((release) => {
        const riskTone =
          release.riskLabel === '高风险'
            ? 'bg-destructive/[0.08] text-destructive'
            : release.riskLabel === '中风险'
              ? 'ui-control-muted text-foreground'
              : 'ui-control text-muted-foreground';

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
              <div className="min-w-0 flex-1 px-4 py-3.5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={release.statusDecoration.color}
                        pulse={release.statusDecoration.pulse}
                        label={release.statusDecoration.label}
                      />
                      <span className="ui-control rounded-full px-2.5 py-1 text-xs font-medium text-foreground">
                        {release.environment.name}
                      </span>
                      <span
                        className={cn('rounded-full px-2.5 py-1 text-xs font-medium', riskTone)}
                      >
                        {release.riskLabel}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">{release.displayTitle}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[
                          release.environmentScope,
                          release.previewSourceMeta.label,
                          `${release.artifacts.length} 个服务`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {release.previewSourceMeta.title ? (
                        <PreviewSourceSummary meta={release.previewSourceMeta} />
                      ) : null}
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
                        {release.primaryDomainUrl && (
                          <a
                            href={release.primaryDomainUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                          >
                            <Rocket className="h-3.5 w-3.5" />
                            <span>环境</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {release.artifacts.slice(0, 3).map((artifact) => (
                        <Badge
                          key={artifact.id}
                          variant="secondary"
                          className="gap-1 rounded-full px-2 py-0.5 font-normal"
                        >
                          <span className="font-medium">{artifact.service.name}</span>
                          <span className="text-muted-foreground">
                            {formatImageLabel(artifact.imageUrl)}
                          </span>
                        </Badge>
                      ))}
                      {release.artifacts.length > 3 ? (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 font-normal">
                          +{release.artifacts.length - 3}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center xl:items-end">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatPlatformTimeContext(release.createdAt) ?? '—'}</span>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-w-0 flex-1 sm:flex-none"
                      >
                        <Link
                          href={`/projects/${projectId}/environments/${release.environment.id}/logs`}
                        >
                          日志
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-w-0 flex-1 sm:flex-none"
                      >
                        <Link href={`/projects/${projectId}/delivery/${release.id}`}>
                          交付
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <ReleaseAIRefreshActions
                        projectId={projectId}
                        releaseId={release.id}
                        compact
                        showMessage={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
