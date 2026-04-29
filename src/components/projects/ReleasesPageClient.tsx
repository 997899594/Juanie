'use client';

import { ArrowUpCircle, Database, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ManualReleaseDialog } from '@/components/projects/ManualReleaseDialog';
import { ReleaseCardList } from '@/components/projects/ReleaseCardList';
import { ReleaseFilterToolbar } from '@/components/projects/ReleaseFilterToolbar';
import { ReleasePromoteDialog } from '@/components/projects/ReleasePromoteDialog';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useReleases } from '@/hooks/useReleases';
import { createPromotionRelease, fetchPromotionPlan } from '@/lib/releases/client-actions';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import type { getProjectReleasesPageData } from '@/lib/releases/service';
import { cn } from '@/lib/utils';

interface ReleasesPageClientProps {
  projectId: string;
  initialData: Awaited<ReturnType<typeof getProjectReleasesPageData>>;
}

function getPromotionPlanKey(flowId?: string | null): string {
  return flowId ?? '__default__';
}

function mergePromotionPlanItems(
  currentPlans: Awaited<ReturnType<typeof getProjectReleasesPageData>>['promotionPlans'],
  plan: Awaited<ReturnType<typeof fetchPromotionPlan>>
): Awaited<ReturnType<typeof getProjectReleasesPageData>>['promotionPlans'] {
  const nextKey = getPromotionPlanKey(plan.flowId);
  const previousPlan = currentPlans.find(
    (currentPlan) => getPromotionPlanKey(currentPlan.flowId) === nextKey
  );
  const nextPlan = {
    ...plan,
    ai: previousPlan?.ai ?? null,
  };
  const hasPlan = currentPlans.some(
    (currentPlan) => getPromotionPlanKey(currentPlan.flowId) === nextKey
  );

  return hasPlan
    ? currentPlans.map((currentPlan) =>
        getPromotionPlanKey(currentPlan.flowId) === nextKey ? nextPlan : currentPlan
      )
    : [...currentPlans, nextPlan];
}

export function ReleasesPageClient({ projectId, initialData }: ReleasesPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [promoting, setPromoting] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promotionPlans, setPromotionPlans] = useState(initialData.promotionPlans);
  const [loadedPromotionPlanKeys, setLoadedPromotionPlanKeys] = useState<Set<string>>(new Set());
  const [promotionPlanLoadingKey, setPromotionPlanLoadingKey] = useState<string | null>(null);
  const [promotionPlanError, setPromotionPlanError] = useState<{
    key: string;
    message: string;
  } | null>(null);
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
    setPromotionPlans(initialData.promotionPlans);
    setLoadedPromotionPlanKeys(new Set());
    setPromotionPlanLoadingKey(null);
    setPromotionPlanError(null);
  }, [initialData.promotionPlans]);

  useEffect(() => {
    const hasSelectedFlow = promotionPlans.some((plan) => plan.flowId === selectedPromotionFlowId);

    if (hasSelectedFlow) {
      return;
    }

    setSelectedPromotionFlowId(
      promotionPlans.find((plan) =>
        plan.targetEnvironment
          ? initialData.governance.promotion.manageableTargetIds.includes(plan.targetEnvironment.id)
          : false
      )?.flowId ??
        promotionPlans[0]?.flowId ??
        null
    );
  }, [
    initialData.governance.promotion.manageableTargetIds,
    promotionPlans,
    selectedPromotionFlowId,
  ]);

  const handlePromote = async () => {
    if (promoting) return;
    const planKey = getPromotionPlanKey(selectedPromotionFlowId);
    if (!loadedPromotionPlanKeys.has(planKey)) {
      toast.error('实时预检还没有完成，请稍等一下');
      return;
    }

    setPromoting(true);

    try {
      const data = await createPromotionRelease({
        projectId,
        flowId: selectedPromotionFlowId,
      });

      toast.success(
        data.tagName
          ? `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'} · 成功后写入 ${data.tagName}`
          : `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'}`
      );
      setPromoteDialogOpen(false);
      if (data.releasePath) {
        router.push(data.releasePath);
        return;
      }

      if (data.releaseId && data.targetEnvironmentId) {
        router.push(buildReleaseDetailPath(projectId, data.targetEnvironmentId, data.releaseId));
        return;
      }

      router.refresh();
    } catch (promoteError) {
      toast.error(promoteError instanceof Error ? promoteError.message : '创建提升发布失败');
    } finally {
      setPromoting(false);
    }
  };

  const environments = initialData.environments;
  const governance = initialData.governance;
  const filter = initialData.selectedEnv;
  const riskFilter = initialData.selectedRisk;
  const defaultRiskFilter = initialData.defaultRiskFilter;
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
  const selectedEnvironment =
    filter !== 'all'
      ? (environments.find((environment) => environment.id === filter) ?? null)
      : null;
  const filtered = initialData.filteredReleaseItems;
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
  const selectedPromotionPlanKey = getPromotionPlanKey(
    selectedPromotionPlan?.flowId ?? selectedPromotionFlowId
  );
  const loadingPromotionPlan =
    promoteDialogOpen && promotionPlanLoadingKey === selectedPromotionPlanKey;
  const selectedPromotionPlanError =
    promotionPlanError?.key === selectedPromotionPlanKey ? promotionPlanError.message : null;
  const selectedPromotionPlanLoaded = loadedPromotionPlanKeys.has(selectedPromotionPlanKey);
  const canManageSelectedTarget = selectedPromotionPlan?.targetEnvironment
    ? governance.promotion.manageableTargetIds.includes(selectedPromotionPlan.targetEnvironment.id)
    : false;
  const canPromote =
    hasPromotionTarget &&
    !!selectedPromotionPlan?.sourceRelease &&
    canManageSelectedTarget &&
    selectedPromotionPlanLoaded &&
    !loadingPromotionPlan &&
    !selectedPromotionPlanError &&
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
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';

  useEffect(() => {
    if (!promoteDialogOpen || !hasPromotionTarget) {
      return;
    }

    const key = getPromotionPlanKey(selectedPromotionFlowId);
    let cancelled = false;

    setPromotionPlanLoadingKey(key);
    setPromotionPlanError(null);

    fetchPromotionPlan({ projectId, flowId: selectedPromotionFlowId })
      .then((plan) => {
        if (cancelled) {
          return;
        }

        setPromotionPlans((currentPlans) => mergePromotionPlanItems(currentPlans, plan));
        setLoadedPromotionPlanKeys((currentKeys) => {
          const nextKeys = new Set(currentKeys);
          nextKeys.add(key);
          return nextKeys;
        });
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        setPromotionPlanError({
          key,
          message: fetchError instanceof Error ? fetchError.message : '加载提升预检失败',
        });
        setLoadedPromotionPlanKeys((currentKeys) => {
          const nextKeys = new Set(currentKeys);
          nextKeys.delete(key);
          return nextKeys;
        });
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setPromotionPlanLoadingKey((currentKey) => (currentKey === key ? null : currentKey));
      });

    return () => {
      cancelled = true;
    };
  }, [hasPromotionTarget, projectId, promoteDialogOpen, selectedPromotionFlowId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`${selectedEnvironment?.name ?? '环境'} · 发布`}
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
                {promoting ? '创建中...' : '提升发布'}
              </Button>
            )}
            {selectedEnvironment ? (
              <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
                <Link href={`/projects/${projectId}/environments/${selectedEnvironment.id}`}>
                  返回环境
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {error && (
        <div className="rounded-2xl bg-[rgba(243,240,233,0.68)] px-4 py-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
          {error}
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
        loadingPlan={loadingPromotionPlan}
        planError={selectedPromotionPlanError}
        onPromote={handlePromote}
      />

      <section className={cn(shellClassName, 'px-4 py-4')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
            <StatusIndicator
              status={isConnected ? 'success' : 'neutral'}
              label={isConnected ? '实时同步' : '未连接'}
            />
            <span>{governance.roleLabel}</span>
            {selectedEnvironment ? <span>{selectedEnvironment.name}</span> : null}
            {!selectedEnvironment ? <span>跨环境</span> : <span>单环境</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedEnvironment ? (
              <>
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <Link
                    href={`/projects/${projectId}/environments/${selectedEnvironment.id}/schema`}
                  >
                    <Database className="h-3.5 w-3.5" />
                    数据
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <Link href={`/projects/${projectId}/environments/${selectedEnvironment.id}/logs`}>
                    <ScrollText className="h-3.5 w-3.5" />
                    日志
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {shouldShowEnvironmentFlow ? (
        <section className="grid gap-3 lg:grid-cols-3">
          <div className={shellClassName}>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              当前环境
            </div>
            <div className="mt-3 text-xl font-semibold tracking-tight text-foreground">
              {selectedEnvironment?.name}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {selectedEnvironment?.scopeLabel ?? selectedEnvironment?.sourceLabel ?? '环境'}
            </div>
            {selectedEnvironment?.deliveryMode === 'promote_only' ? (
              <div className="mt-3 text-xs text-muted-foreground">仅接受提升</div>
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

          <div className={shellClassName}>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              进入方式
            </div>
            {incomingPromotionPlans.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {incomingPromotionPlans.slice(0, 3).map((plan) => (
                  <div
                    key={
                      plan.flowId ?? `${plan.sourceEnvironment?.id}-${plan.targetEnvironment?.id}`
                    }
                    className="rounded-2xl bg-secondary/72 px-3 py-2.5 text-sm text-foreground"
                  >
                    {`${plan.sourceEnvironment?.name ?? '来源环境'} -> ${plan.targetEnvironment?.name ?? '当前环境'}`}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                直接发布
              </div>
            )}
            {incomingPromotionPlans.some((plan) => plan.requiresApproval) ? (
              <div className="mt-3 text-xs text-muted-foreground">含审批</div>
            ) : null}
          </div>

          <div className={shellClassName}>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              后续去向
            </div>
            {outgoingPromotionPlans.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {outgoingPromotionPlans.slice(0, 3).map((plan) => (
                  <div
                    key={
                      plan.flowId ?? `${plan.sourceEnvironment?.id}-${plan.targetEnvironment?.id}`
                    }
                    className="rounded-2xl bg-secondary/72 px-3 py-2.5 text-sm text-foreground"
                  >
                    {`${plan.sourceEnvironment?.name ?? '当前环境'} -> ${plan.targetEnvironment?.name ?? '目标环境'}`}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                无后续链路
              </div>
            )}
            {outgoingPromotionPlans.some((plan) => plan.requiresApproval) ? (
              <div className="mt-3 text-xs text-muted-foreground">含审批</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <ReleaseFilterToolbar
        environmentOptions={initialData.environmentOptions}
        filter={filter}
        riskFilter={riskFilter}
        onChange={updateFilters}
      />

      <ReleaseCardList projectId={projectId} releases={filtered} />

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="flex items-center gap-2 rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] p-2 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)] backdrop-blur">
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
          {hasPromotionTarget && (
            <Button
              size="sm"
              onClick={() => setPromoteDialogOpen(true)}
              disabled={promoting || !governance.promotion.allowed}
              title={promoteButtonTitle}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              {promoting ? '创建中...' : '提升'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
