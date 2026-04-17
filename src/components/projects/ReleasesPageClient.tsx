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
  const selectedEnvironment =
    filter !== 'all'
      ? (environments.find((environment) => environment.id === filter) ?? null)
      : null;
  const filtered = initialData.filteredReleaseItems;
  const promotionPlans = initialData.promotionPlans;
  const incomingPromotionPlans = selectedEnvironment
    ? promotionPlans.filter((plan) => plan.targetEnvironment?.id === selectedEnvironment.id)
    : [];
  const outgoingPromotionPlans = selectedEnvironment
    ? promotionPlans.filter((plan) => plan.sourceEnvironment?.id === selectedEnvironment.id)
    : [];
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
  const shouldShowEnvironmentFlow =
    !!selectedEnvironment &&
    ((selectedEnvironment.deliveryRules?.length ?? 0) > 0 ||
      incomingPromotionPlans.length > 0 ||
      outgoingPromotionPlans.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={selectedEnvironment ? `${selectedEnvironment.name} 发布` : '发布总览'}
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
            {selectedEnvironment ? (
              <Button asChild variant="outline" size="sm" className="h-9 px-4">
                <Link href={`/projects/${projectId}/environments/${selectedEnvironment.id}`}>
                  返回环境
                </Link>
              </Button>
            ) : null}
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
          {selectedEnvironment ? <span>{selectedEnvironment.name}</span> : null}
          {!selectedEnvironment && hasPromotionTarget ? (
            <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
              <Link href={`/projects/${projectId}`}>
                <ScrollText className="h-3.5 w-3.5" />
                项目
              </Link>
            </Button>
          ) : null}
          {selectedEnvironment ? (
            <>
              <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
                <Link href={`/projects/${projectId}/schema?env=${selectedEnvironment.id}`}>
                  <Database className="h-3.5 w-3.5" />
                  数据
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
                <Link href={`/projects/${projectId}/environments/${selectedEnvironment.id}/logs`}>
                  <ScrollText className="h-3.5 w-3.5" />
                  日志
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg px-2.5">
              <Link href={`/projects/${projectId}/schema`}>
                <Database className="h-3.5 w-3.5" />
                数据
              </Link>
            </Button>
          )}
        </div>
        {!selectedEnvironment ? (
          <div className="mt-2 text-xs text-muted-foreground">
            这里只看跨环境发布记录。进入环境后再执行发布。
          </div>
        ) : null}
      </div>

      {shouldShowEnvironmentFlow ? (
        <section className="grid gap-3 lg:grid-cols-3">
          <div className="console-surface rounded-[24px] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              当前环境
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {selectedEnvironment?.name}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {selectedEnvironment?.scopeLabel ??
                selectedEnvironment?.sourceLabel ??
                '当前发布环境'}
            </div>
            {selectedEnvironment?.deliveryMode === 'promote_only' ? (
              <div className="mt-3 text-xs text-muted-foreground">
                当前环境只接受提升，不直接发布。
              </div>
            ) : null}
            {(selectedEnvironment?.deliveryRules?.length ?? 0) > 0 ? (
              <div className="mt-3 text-xs text-muted-foreground">
                {(selectedEnvironment?.deliveryRules ?? [])
                  .slice(0, 2)
                  .map((rule) =>
                    `${rule.kind === 'pull_request' ? 'PR' : rule.kind === 'branch' ? '分支' : rule.kind === 'tag' ? '标签' : '手动'} ${rule.pattern ?? ''}`.trim()
                  )
                  .join(' · ')}
              </div>
            ) : null}
          </div>

          <div className="console-surface rounded-[24px] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              进入方式
            </div>
            {incomingPromotionPlans.length > 0 ? (
              <div className="mt-2 space-y-2">
                {incomingPromotionPlans.slice(0, 3).map((plan) => (
                  <div
                    key={
                      plan.flowId ?? `${plan.sourceEnvironment?.id}-${plan.targetEnvironment?.id}`
                    }
                    className="text-sm text-foreground"
                  >
                    {`${plan.sourceEnvironment?.name ?? '来源环境'} -> ${plan.targetEnvironment?.name ?? '当前环境'}`}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-foreground">直接在当前环境发布</div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              {incomingPromotionPlans.some((plan) => plan.requiresApproval)
                ? '部分进入链路需要审批。'
                : '当前进入链路不需要额外审批。'}
            </div>
          </div>

          <div className="console-surface rounded-[24px] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              后续去向
            </div>
            {outgoingPromotionPlans.length > 0 ? (
              <div className="mt-2 space-y-2">
                {outgoingPromotionPlans.slice(0, 3).map((plan) => (
                  <div
                    key={
                      plan.flowId ?? `${plan.sourceEnvironment?.id}-${plan.targetEnvironment?.id}`
                    }
                    className="text-sm text-foreground"
                  >
                    {`${plan.sourceEnvironment?.name ?? '当前环境'} -> ${plan.targetEnvironment?.name ?? '目标环境'}`}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-foreground">当前环境没有后续提升链路</div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              {outgoingPromotionPlans.some((plan) => plan.requiresApproval)
                ? '提升到后续环境时可能需要审批。'
                : '没有额外的后续提升限制。'}
            </div>
          </div>
        </section>
      ) : null}

      {!selectedEnvironment ? (
        <ReleaseFilterToolbar
          environmentOptions={initialData.environmentOptions}
          filter={filter}
          riskFilter={riskFilter}
          onChange={updateFilters}
        />
      ) : null}

      <ReleaseCardList projectId={projectId} releases={filtered} />

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="ui-floating flex items-center gap-2 rounded-[24px] p-2 backdrop-blur">
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1">
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
