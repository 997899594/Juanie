'use client';

import { ArrowUpCircle, Database, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
import { ReleaseCardList } from '@/components/projects/ReleaseCardList';
import { ReleaseFilterToolbar } from '@/components/projects/ReleaseFilterToolbar';
import { ReleasePromoteDialog } from '@/components/projects/ReleasePromoteDialog';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { createProductionRelease } from '@/lib/releases/client-actions';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import type { getProjectReleasesPageData } from '@/lib/releases/service';
import { cn } from '@/lib/utils';

interface ReleasesPageClientProps {
  projectId: string;
  initialData: Awaited<ReturnType<typeof getProjectReleasesPageData>>;
}

export function ReleasesPageClient({ projectId, initialData }: ReleasesPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
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

  const handlePromote = async () => {
    if (promoting) return;
    setPromoting(true);
    setPromoteResult(null);

    try {
      const data = await createProductionRelease({ projectId });

      setPromoteResult(data.tagName ? `已创建生产发布 · ${data.tagName}` : '已创建生产发布');
      setPromoteDialogOpen(false);
      router.refresh();
    } catch (promoteError) {
      setPromoteResult(
        `错误：${promoteError instanceof Error ? promoteError.message : '创建生产发布失败'}`
      );
    } finally {
      setPromoting(false);
      setTimeout(() => setPromoteResult(null), 5000);
    }
  };

  const updateFilters = (next: {
    env?: string;
    risk?: 'all' | 'attention' | 'approval' | 'failed';
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextEnv = next.env ?? filter;
    const nextRisk = next.risk ?? riskFilter;

    if (nextEnv === 'all') params.delete('env');
    else params.set('env', nextEnv);

    if (nextRisk === 'attention') params.delete('risk');
    else params.set('risk', nextRisk);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const releaseItems = initialData.releaseItems;
  const environments = initialData.environments;
  const governance = initialData.governance;
  const filter = initialData.selectedEnv;
  const riskFilter = initialData.selectedRisk;
  const filtered = initialData.filteredReleaseItems;
  const promotePlan = initialData.promotePlan;
  const manageableEnvironments = environments.filter((environment) =>
    governance.manageableEnvironmentIds.includes(environment.id)
  );
  const hasPromotionTarget = initialData.hasPromotionTarget;
  const sourcePromotionReleaseId = promotePlan?.sourceRelease?.id ?? null;
  const latestPromotionSourceRelease = sourcePromotionReleaseId
    ? (releaseItems.find((release) => release.id === sourcePromotionReleaseId) ?? null)
    : null;
  const canPromote =
    hasPromotionTarget &&
    !!latestPromotionSourceRelease &&
    governance.promoteToProduction.allowed &&
    (promotePlan?.plan.canCreate ?? true) &&
    !promotePlan?.plan.blockingReason;
  const promoteAI = initialData.promoteAI;
  const manualReleaseSources = initialData.manualReleaseSources.map((release) => ({
    ...release,
    sourceRef: release.sourceRef ?? '',
    sourceCommitSha: release.sourceCommitSha ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="交付"
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            {hasPromotionTarget && (
              <Button
                size="sm"
                className="h-9 px-4"
                onClick={() => setPromoteDialogOpen(true)}
                disabled={promoting || !canPromote}
                title={governance.promoteToProduction.summary}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {promoting ? '发布中...' : '发布到生产'}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="ui-control-muted rounded-2xl px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {promoteResult && (
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            promoteResult.startsWith('错误')
              ? 'bg-destructive/[0.08] text-destructive'
              : 'ui-control-muted text-foreground'
          )}
        >
          {promoteResult}
        </div>
      )}

      <ReleasePromoteDialog
        open={promoteDialogOpen}
        onOpenChange={setPromoteDialogOpen}
        promotePlan={promotePlan}
        promoteAI={promoteAI}
        canPromote={canPromote}
        promoting={promoting}
        onPromote={handlePromote}
      />

      <div className="ui-control-muted px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusIndicator
            status={isConnected ? 'success' : 'neutral'}
            label={isConnected ? '实时同步' : '未连接'}
          />
          <span>{governance.roleLabel}</span>
          {hasPromotionTarget ? (
            <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
              <Link href={`/projects/${projectId}`}>
                <ScrollText className="h-3.5 w-3.5" />
                项目
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
            <Link href={`/projects/${projectId}/schema`}>
              <Database className="h-3.5 w-3.5" />
              数据
            </Link>
          </Button>
        </div>
      </div>

      <ReleaseFilterToolbar
        environmentOptions={initialData.environmentOptions}
        filter={filter}
        riskFilter={riskFilter}
        onChange={updateFilters}
      />

      <ReleaseCardList projectId={projectId} releases={filtered} />

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="ui-floating flex items-center gap-2 rounded-[24px] p-2 backdrop-blur">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
            <Link href={`/projects/${projectId}`}>
              <ScrollText className="h-3.5 w-3.5" />
              项目
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
          {hasPromotionTarget && (
            <Button
              size="sm"
              onClick={() => setPromoteDialogOpen(true)}
              disabled={promoting || !canPromote}
              title={governance.promoteToProduction.summary}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              生产
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
