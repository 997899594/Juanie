'use client';

import { ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EnvironmentPageFrame } from '@/components/projects/EnvironmentPageFrame';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
import { ReleaseCardList } from '@/components/projects/ReleaseCardList';
import { ReleaseFilterToolbar } from '@/components/projects/ReleaseFilterToolbar';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import type { getProjectReleasesPageData } from '@/lib/releases/service';

interface ReleasesPageClientProps {
  projectId: string;
  initialData: Awaited<ReturnType<typeof getProjectReleasesPageData>>;
}

export function ReleasesPageClient({ projectId, initialData }: ReleasesPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLatestRelease = initialData.releaseItems[0];
  const initialLatestReleaseState = buildReleaseEventStateKey(
    initialLatestRelease
      ? {
          id: initialLatestRelease.id,
          status: initialLatestRelease.status,
          sourceCommitSha: initialLatestRelease.sourceCommitSha ?? null,
          updatedAt: initialLatestRelease.createdAt ?? new Date(0).toISOString(),
          recap: initialLatestRelease.recap
            ? {
                generatedAt: initialLatestRelease.recap.generatedAt ?? null,
              }
            : null,
        }
      : null
  );

  const { isConnected, error } = useReleases({
    projectId,
    initialStateKey: initialLatestReleaseState,
    onRelease: () => router.refresh(),
  });
  const environments = initialData.environments;
  const governance = initialData.governance;
  const filter = initialData.selectedEnv;
  const riskFilter = initialData.selectedRisk;
  const defaultRiskFilter = initialData.defaultRiskFilter;
  const selectedEnvironment =
    filter !== 'all'
      ? (environments.find((environment) => environment.id === filter) ?? null)
      : null;

  const updateFilters = (next: {
    env?: string;
    risk?: 'all' | 'attention' | 'approval' | 'failed';
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextEnv = next.env ?? filter;
    const nextRisk = next.risk ?? riskFilter;

    if (nextEnv === 'all') params.delete('env');
    else params.set('env', nextEnv);

    if (nextRisk === defaultRiskFilter) params.delete('risk');
    else params.set('risk', nextRisk);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const filtered = initialData.filteredReleaseItems;
  const manageableEnvironments = environments.filter((environment) => {
    if (!governance.manageableEnvironmentIds.includes(environment.id)) {
      return false;
    }

    if (environment.deliveryMode === 'promote_only') {
      return false;
    }

    if (selectedEnvironment) {
      return environment.id === selectedEnvironment.id;
    }

    return true;
  });
  const manualReleaseSources = initialData.manualReleaseSources.map((release) => ({
    ...release,
    sourceRef: release.sourceRef ?? '',
    sourceCommitSha: release.sourceCommitSha ?? null,
  }));

  return (
    <EnvironmentPageFrame
      projectId={projectId}
      environmentId={selectedEnvironment?.id}
      showEnvironmentNav={Boolean(selectedEnvironment)}
      title={`${selectedEnvironment?.name ?? '环境'} · 发布`}
      actions={
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <StatusIndicator
            status={isConnected ? 'success' : 'neutral'}
            label={isConnected ? '在线' : '离线'}
            pulse={isConnected}
          />
          <ManualReleaseDialog
            projectId={projectId}
            environments={manageableEnvironments}
            releases={manualReleaseSources}
            disabledSummary={governance.primarySummary}
            onCreated={async () => {
              router.refresh();
            }}
          />
          {selectedEnvironment ? (
            <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
              <Link href={`/projects/${projectId}/environments/${selectedEnvironment.id}`}>
                返回环境
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {error && <div className="console-inset px-4 py-3 text-sm text-foreground">{error}</div>}

      <ReleaseFilterToolbar
        environmentOptions={initialData.environmentOptions}
        filter={filter}
        riskFilter={riskFilter}
        onChange={updateFilters}
      />

      <ReleaseCardList projectId={projectId} releases={filtered} />

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="console-panel flex items-center gap-2 rounded-[24px] p-2 backdrop-blur">
          <Button asChild variant="ghost" size="sm" className="min-w-0 flex-1 rounded-full">
            <Link
              href={
                selectedEnvironment
                  ? `/projects/${projectId}/environments/${selectedEnvironment.id}`
                  : `/projects/${projectId}`
              }
            >
              <ScrollText className="h-3.5 w-3.5" />
              {selectedEnvironment ? '环境' : '项目'}
            </Link>
          </Button>
          <ManualReleaseDialog
            projectId={projectId}
            environments={manageableEnvironments}
            releases={manualReleaseSources}
            disabledSummary={governance.primarySummary}
            onCreated={async () => {
              router.refresh();
            }}
          />
        </div>
      </div>
    </EnvironmentPageFrame>
  );
}
