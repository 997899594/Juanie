'use client';

import { ArrowUpCircle, Database, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
import { ReleaseCardList } from '@/components/projects/ReleaseCardList';
import { ReleaseFilterToolbar } from '@/components/projects/ReleaseFilterToolbar';
import { ReleasePromoteDialog } from '@/components/projects/ReleasePromoteDialog';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { createPromotionRelease } from '@/lib/releases/client-actions';
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
  const [selectedPromotionFlowId, setSelectedPromotionFlowId] = useState<string | null>(
    initialData.promotionPlans.find((plan) =>
      plan.targetEnvironment
        ? initialData.governance.promotion.manageableTargetIds.includes(plan.targetEnvironment.id)
        : false
    )?.flowId ??
      initialData.promotionPlans[0]?.flowId ??
      null
  );
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

  useEffect(() => {
    const hasSelectedFlow = initialData.promotionPlans.some(
      (plan) => plan.flowId === selectedPromotionFlowId
    );

    if (hasSelectedFlow) {
      return;
    }

    setSelectedPromotionFlowId(
      initialData.promotionPlans.find((plan) =>
        plan.targetEnvironment
          ? initialData.governance.promotion.manageableTargetIds.includes(plan.targetEnvironment.id)
          : false
      )?.flowId ??
        initialData.promotionPlans[0]?.flowId ??
        null
    );
  }, [
    initialData.governance.promotion.manageableTargetIds,
    initialData.promotionPlans,
    selectedPromotionFlowId,
  ]);

  const handlePromote = async () => {
    if (promoting) return;
    setPromoting(true);
    setPromoteResult(null);

    try {
      const data = await createPromotionRelease({
        projectId,
        flowId: selectedPromotionFlowId,
      });

      setPromoteResult(
        data.tagName
          ? `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'} · 成功后写入 ${data.tagName}`
          : `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'}`
      );
      setPromoteDialogOpen(false);
      router.refresh();
    } catch (promoteError) {
      setPromoteResult(
        `错误：${promoteError instanceof Error ? promoteError.message : '创建提升发布失败'}`
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

  const environments = initialData.environments;
  const governance = initialData.governance;
  const filter = initialData.selectedEnv;
  const riskFilter = initialData.selectedRisk;
  const filtered = initialData.filteredReleaseItems;
  const promotionPlans = initialData.promotionPlans;
  const manageableEnvironments = environments.filter(
    (environment) =>
      governance.manageableEnvironmentIds.includes(environment.id) &&
      environment.deliveryMode !== 'promote_only'
  );
  const hasPromotionTarget = initialData.hasPromotionTarget;
  const selectedPromotionPlan =
    promotionPlans.find((plan) => plan.flowId === selectedPromotionFlowId) ??
    promotionPlans[0] ??
    null;
  const canManageSelectedTarget = selectedPromotionPlan?.targetEnvironment
    ? governance.promotion.manageableTargetIds.includes(selectedPromotionPlan.targetEnvironment.id)
    : false;
  const canPromote =
    hasPromotionTarget &&
    !!selectedPromotionPlan?.sourceRelease &&
    canManageSelectedTarget &&
    (selectedPromotionPlan.plan.canCreate ?? true) &&
    !selectedPromotionPlan.plan.blockingReason;
  const promoteButtonTitle =
    !selectedPromotionPlan || !selectedPromotionPlan.targetEnvironment
      ? governance.promotion.summary
      : !canManageSelectedTarget
        ? governance.promotion.summary
        : (selectedPromotionPlan.plan.blockingReason ??
          `将 ${selectedPromotionPlan.sourceEnvironment?.name ?? '来源环境'} 提升到 ${selectedPromotionPlan.targetEnvironment.name}`);
  const manualReleaseSources = initialData.manualReleaseSources.map((release) => ({
    ...release,
    sourceRef: release.sourceRef ?? '',
    sourceCommitSha: release.sourceCommitSha ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="发布"
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
                disabled={promoting || !governance.promotion.allowed}
                title={promoteButtonTitle}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {promoting ? '提升中...' : '提升发布'}
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
        promotionPlans={promotionPlans}
        selectedFlowId={selectedPromotionFlowId}
        onSelectedFlowIdChange={setSelectedPromotionFlowId}
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
              disabled={promoting || !governance.promotion.allowed}
              title={promoteButtonTitle}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              提升
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
