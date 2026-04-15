'use client';

import { Globe } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { getProjectReleasesPageData } from '@/lib/releases/service';
import { cn } from '@/lib/utils';

type ReleasePageData = Awaited<ReturnType<typeof getProjectReleasesPageData>>;

interface ReleaseEnvironmentCenterProps {
  projectId: string;
  items: Array<{
    environment: ReleasePageData['environments'][number];
    latestRelease: ReleasePageData['releaseItems'][number] | null;
  }>;
  onShowRecords: (environmentName: string) => void;
}

export function ReleaseEnvironmentCenter({
  projectId,
  items,
  onShowRecords,
}: ReleaseEnvironmentCenterProps) {
  return (
    <section className="ui-floating px-4 py-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Globe className="h-4 w-4" />
        环境发布
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ environment, latestRelease }) => (
          <div key={environment.id} className="ui-control-muted px-4 py-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  latestRelease?.status === 'succeeded'
                    ? 'bg-success'
                    : latestRelease?.status === 'failed' ||
                        latestRelease?.status === 'migration_pre_failed'
                      ? 'bg-destructive'
                      : latestRelease
                        ? 'bg-warning'
                        : 'bg-muted-foreground'
                )}
              />
              <span className="text-sm font-medium">{environment.name}</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {[environment.scopeLabel, environment.sourceLabel, environment.deploymentStrategy]
                .filter(Boolean)
                .join(' · ')}
            </div>

            <div className="mt-3">
              {latestRelease ? (
                <>
                  <div className="text-sm font-medium">{latestRelease.displayTitle}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {latestRelease.recap?.primarySummary ??
                      latestRelease.platformSignals.primarySummary ??
                      '详情'}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {[
                      latestRelease.statusDecoration.label,
                      latestRelease.sourceCommitSha
                        ? latestRelease.sourceCommitSha.slice(0, 7)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </>
              ) : (
                <div className="text-sm font-medium">没有发布</div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href={`/projects/${projectId}/runtime/logs?env=${environment.id}`}>日志</Link>
              </Button>
              {latestRelease ? (
                <Button asChild size="sm" className="rounded-xl">
                  <Link href={`/projects/${projectId}/delivery/${latestRelease.id}`}>交付</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => onShowRecords(environment.name)}
                >
                  记录
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
