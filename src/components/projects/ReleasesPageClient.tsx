'use client';

import { ArrowUpCircle, Database, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
import { ReleaseCardList } from '@/components/projects/ReleaseCardList';
import { ReleaseEnvironmentCenter } from '@/components/projects/ReleaseEnvironmentCenter';
import { ReleaseFilterToolbar } from '@/components/projects/ReleaseFilterToolbar';
import { ReleasePromoteDialog } from '@/components/projects/ReleasePromoteDialog';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PlatformSignalChipList, PlatformSignalSummary } from '@/components/ui/platform-signals';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { createProductionRelease } from '@/lib/releases/client-actions';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
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

    if (nextRisk === 'all') params.delete('risk');
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
  const environmentReleaseCenter = environments.map((environment) => {
    const latestRelease =
      releaseItems.find((release) => release.environment.id === environment.id) ?? null;

    return {
      environment,
      latestRelease,
    };
  });

  const stagingEnv = environments.find(
    (environment) => environment.autoDeploy && !environment.isProduction
  );
  const latestStagingRelease = stagingEnv
    ? releaseItems.find(
        (release) =>
          release.environment.id === stagingEnv.id &&
          release.status === 'succeeded' &&
          release.artifacts.length > 0
      )
    : null;
  const hasStagingProdSplit = initialData.hasStagingProdSplit;
  const canPromote =
    hasStagingProdSplit &&
    !!latestStagingRelease &&
    governance.promoteToProduction.allowed &&
    (promotePlan?.plan.canCreate ?? true) &&
    !promotePlan?.plan.blockingReason;
  const promotePanel = promotePlan
    ? buildReleasePlanningPanel({
        plan: promotePlan.plan,
        sourceCommitSha: promotePlan.sourceRelease?.sourceCommitSha,
      })
    : null;
  const stats = initialData.stats.map((stat) =>
    stat.label === '实时' ? { ...stat, value: isConnected ? '在线' : '离线' } : stat
  );
  const promoteAI = initialData.promoteAI;
  const manualReleaseSources = initialData.manualReleaseSources.map((release) => ({
    ...release,
    sourceRef: release.sourceRef ?? '',
    sourceCommitSha: release.sourceCommitSha ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="发布"
        description="按环境查看当前版本、风险信号与发布记录。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={isConnected ? 'success' : 'neutral'}
              label={isConnected ? '在线' : '离线'}
              pulse={isConnected}
            />
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={`/projects/${projectId}/runtime/logs`}>
                <ScrollText className="h-3.5 w-3.5" />
                打开日志
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={`/projects/${projectId}/schema`}>
                <Database className="h-3.5 w-3.5" />
                Schema Center
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
            {hasStagingProdSplit && (
              <Button
                size="sm"
                className="h-9 rounded-xl px-4"
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
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {promoteResult && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            promoteResult.startsWith('错误')
              ? 'border-destructive/20 bg-background text-destructive'
              : 'border-border bg-secondary/20 text-foreground'
          )}
        >
          {promoteResult}
        </div>
      )}

      <details className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer list-none font-medium text-foreground">
          发布控制面
        </summary>
        <div className="mt-2">
          当前角色：{governance.roleLabel}。{governance.primarySummary}。
          {governance.promoteToProduction.summary}。
        </div>
      </details>

      <ReleaseEnvironmentCenter
        projectId={projectId}
        items={environmentReleaseCenter}
        onShowRecords={(environmentName) =>
          updateFilters({
            env: environmentName,
            risk: 'all',
          })
        }
      />

      <ReleasePromoteDialog
        open={promoteDialogOpen}
        onOpenChange={setPromoteDialogOpen}
        promotePlan={promotePlan}
        promoteAI={promoteAI}
        canPromote={canPromote}
        promoting={promoting}
        onPromote={handlePromote}
      />

      {hasStagingProdSplit && promotePanel && (
        <div className="console-panel px-4 py-4">
          <PlatformSignalChipList chips={promotePanel.chips} className="items-center" />
          {promotePanel.blockingReason && (
            <div className="mt-3 text-sm text-muted-foreground">{promotePanel.blockingReason}</div>
          )}
          <PlatformSignalSummary
            summary={promotePanel.issueSummary}
            nextActionLabel={promotePanel.nextActionLabel}
            className="mt-3"
          />
          {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
            <PlatformSignalChipList
              chips={promotePanel.warningChips.slice(0, 3)}
              className="mt-3"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <ReleaseFilterToolbar
        environmentOptions={initialData.environmentOptions}
        filter={filter}
        riskFilter={riskFilter}
        onChange={updateFilters}
      />

      <ReleaseCardList projectId={projectId} releases={filtered} />

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="flex items-center gap-2 rounded-[24px] border border-border bg-background/95 p-2 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={`/projects/${projectId}/logs`}>
              <ScrollText className="h-3.5 w-3.5" />
              日志
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
          {hasStagingProdSplit && (
            <Button
              size="sm"
              className="rounded-xl"
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
