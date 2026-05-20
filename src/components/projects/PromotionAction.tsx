'use client';

import { ArrowUpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ReleasePromoteDialog } from '@/components/projects/ReleasePromoteDialog';
import { Button } from '@/components/ui/button';
import { useSchemaRepairs } from '@/hooks/useSchemaRepairs';
import { createPromotionRelease, fetchPromotionPlan } from '@/lib/releases/client-actions';
import type { ReleasePageGovernanceSnapshot } from '@/lib/releases/governance-view';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import type { ProjectPromotionPlanView } from '@/lib/releases/service';

interface PromotionActionProps {
  projectId: string;
  promotionPlans: ProjectPromotionPlanView[];
  governance: Pick<ReleasePageGovernanceSnapshot, 'promotion'>;
  sourceEnvironmentId?: string | null;
  className?: string;
  compact?: boolean;
}

interface PromotionPlanRefreshInput {
  key: string;
  flowId: string | null;
  refreshSchema?: boolean;
  loadingKey?: boolean;
  refreshingKey?: boolean;
  errorMessage: string;
}

function getPromotionPlanKey(flowId?: string | null): string {
  return flowId ?? '__default__';
}

function mergePromotionPlanItems(
  currentPlans: ProjectPromotionPlanView[],
  plan: Awaited<ReturnType<typeof fetchPromotionPlan>>
): ProjectPromotionPlanView[] {
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

function hasActiveSchemaRefresh(plan: Pick<ProjectPromotionPlanView, 'plan'> | null): boolean {
  const refresh = plan?.plan.schema.refresh;
  return Boolean(refresh && refresh.queuedCount + refresh.runningCount > 0);
}

export function PromotionAction({
  projectId,
  promotionPlans: initialPromotionPlans,
  governance,
  sourceEnvironmentId = null,
  className = 'h-9 rounded-full px-4',
  compact = false,
}: PromotionActionProps) {
  const router = useRouter();
  const [promoting, setPromoting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promotionPlans, setPromotionPlans] = useState(initialPromotionPlans);
  const [loadedPlanKeys, setLoadedPlanKeys] = useState<Set<string>>(new Set());
  const [planLoadingKey, setPlanLoadingKey] = useState<string | null>(null);
  const [planRefreshingKey, setPlanRefreshingKey] = useState<string | null>(null);
  const [planError, setPlanError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const schemaRefreshFollowUpTimerRef = useRef<number | null>(null);
  const planRequestSeqRef = useRef(0);
  const latestPlanRequestSeqByKeyRef = useRef(new Map<string, number>());
  const refreshPromotionPlanRef = useRef<((input: PromotionPlanRefreshInput) => void) | null>(null);
  const dialogOpenRef = useRef(dialogOpen);
  const activePromotionPlans = sourceEnvironmentId
    ? promotionPlans.filter((plan) => plan.sourceEnvironment?.id === sourceEnvironmentId)
    : promotionPlans;
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(
    activePromotionPlans.find((plan) =>
      plan.targetEnvironment
        ? governance.promotion.manageableTargetIds.includes(plan.targetEnvironment.id)
        : false
    )?.flowId ??
      activePromotionPlans[0]?.flowId ??
      null
  );
  const hasPromotionTarget = activePromotionPlans.length > 0;
  const selectedPlan =
    activePromotionPlans.find((plan) => plan.flowId === selectedFlowId) ??
    activePromotionPlans[0] ??
    null;
  const selectedPlanKey = getPromotionPlanKey(selectedPlan?.flowId ?? selectedFlowId);
  const loadingPlan = dialogOpen && planLoadingKey === selectedPlanKey;
  const refreshingPlan = dialogOpen && planRefreshingKey === selectedPlanKey;
  const selectedPlanError = planError?.key === selectedPlanKey ? planError.message : null;
  const selectedPlanLoaded = loadedPlanKeys.has(selectedPlanKey);
  const canManageTarget = selectedPlan?.targetEnvironment
    ? governance.promotion.manageableTargetIds.includes(selectedPlan.targetEnvironment.id)
    : false;
  const canPromote =
    hasPromotionTarget &&
    !!selectedPlan?.sourceRelease &&
    canManageTarget &&
    selectedPlanLoaded &&
    !loadingPlan &&
    !selectedPlanError &&
    (selectedPlan.plan.canCreate ?? true) &&
    !selectedPlan.plan.blockingReason;
  const buttonTitle =
    !selectedPlan || !selectedPlan.targetEnvironment
      ? '当前环境没有下游提升链路'
      : !canManageTarget
        ? governance.promotion.summary
        : (selectedPlan.plan.blockingReason ?? `提升到 ${selectedPlan.targetEnvironment.name}`);
  const buttonLabel = promoting
    ? '创建中...'
    : selectedPlan?.targetEnvironment?.name
      ? `提升到 ${selectedPlan.targetEnvironment.name}`
      : compact
        ? '提升'
        : '提升到下游';

  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  const clearSchemaRefreshFollowUpTimer = useCallback(() => {
    if (schemaRefreshFollowUpTimerRef.current !== null) {
      window.clearTimeout(schemaRefreshFollowUpTimerRef.current);
      schemaRefreshFollowUpTimerRef.current = null;
    }
  }, []);

  const refreshPromotionPlan = useCallback(
    (input: PromotionPlanRefreshInput) => {
      const requestSeq = planRequestSeqRef.current + 1;
      planRequestSeqRef.current = requestSeq;
      latestPlanRequestSeqByKeyRef.current.set(input.key, requestSeq);

      if (input.loadingKey) {
        setPlanLoadingKey(input.key);
        setPlanError(null);
      } else if (input.refreshingKey) {
        setPlanRefreshingKey(input.key);
      }

      return fetchPromotionPlan({
        projectId,
        flowId: input.flowId,
        refreshSchema: input.refreshSchema,
      })
        .then((plan) => {
          if (latestPlanRequestSeqByKeyRef.current.get(input.key) !== requestSeq) {
            return;
          }

          setPromotionPlans((currentPlans) => mergePromotionPlanItems(currentPlans, plan));
          setLoadedPlanKeys((currentKeys) => {
            const nextKeys = new Set(currentKeys);
            nextKeys.add(input.key);
            return nextKeys;
          });
          setPlanError((currentError) => (currentError?.key === input.key ? null : currentError));

          clearSchemaRefreshFollowUpTimer();
          if (dialogOpenRef.current && hasActiveSchemaRefresh(plan)) {
            schemaRefreshFollowUpTimerRef.current = window.setTimeout(() => {
              if (!dialogOpenRef.current) {
                return;
              }

              refreshPromotionPlanRef.current?.({
                key: input.key,
                flowId: input.flowId,
                refreshingKey: true,
                errorMessage: '同步最新 Schema 预检失败',
              });
            }, 2500);
          }
        })
        .catch((error) => {
          if (latestPlanRequestSeqByKeyRef.current.get(input.key) !== requestSeq) {
            return;
          }

          setPlanError({
            key: input.key,
            message: error instanceof Error ? error.message : input.errorMessage,
          });
          if (input.loadingKey) {
            setLoadedPlanKeys((currentKeys) => {
              const nextKeys = new Set(currentKeys);
              nextKeys.delete(input.key);
              return nextKeys;
            });
          }
        })
        .finally(() => {
          setPlanLoadingKey((currentKey) => (currentKey === input.key ? null : currentKey));
          setPlanRefreshingKey((currentKey) => (currentKey === input.key ? null : currentKey));
        });
    },
    [clearSchemaRefreshFollowUpTimer, projectId]
  );

  useEffect(() => {
    refreshPromotionPlanRef.current = refreshPromotionPlan;
  }, [refreshPromotionPlan]);

  useEffect(() => {
    setPromotionPlans(initialPromotionPlans);
    setLoadedPlanKeys(new Set());
    setPlanLoadingKey(null);
    setPlanRefreshingKey(null);
    setPlanError(null);
    clearSchemaRefreshFollowUpTimer();
    latestPlanRequestSeqByKeyRef.current.clear();
  }, [clearSchemaRefreshFollowUpTimer, initialPromotionPlans]);

  useEffect(() => {
    const hasSelectedFlow = activePromotionPlans.some((plan) => plan.flowId === selectedFlowId);
    if (hasSelectedFlow) {
      return;
    }

    setSelectedFlowId(
      activePromotionPlans.find((plan) =>
        plan.targetEnvironment
          ? governance.promotion.manageableTargetIds.includes(plan.targetEnvironment.id)
          : false
      )?.flowId ??
        activePromotionPlans[0]?.flowId ??
        null
    );
  }, [activePromotionPlans, governance.promotion.manageableTargetIds, selectedFlowId]);

  useEffect(
    () => () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      clearSchemaRefreshFollowUpTimer();
    },
    [clearSchemaRefreshFollowUpTimer]
  );

  useEffect(() => {
    if (selectedPlanKey) {
      clearSchemaRefreshFollowUpTimer();
    }
  }, [clearSchemaRefreshFollowUpTimer, selectedPlanKey]);

  useEffect(() => {
    if (!dialogOpen) {
      clearSchemaRefreshFollowUpTimer();
    }

    return () => {
      clearSchemaRefreshFollowUpTimer();
    };
  }, [clearSchemaRefreshFollowUpTimer, dialogOpen]);

  useEffect(() => {
    if (!dialogOpen || !hasPromotionTarget) {
      return;
    }

    const key = getPromotionPlanKey(selectedFlowId);

    refreshPromotionPlan({
      key,
      flowId: selectedFlowId,
      refreshSchema: true,
      loadingKey: true,
      errorMessage: '加载提升预检失败',
    });
  }, [dialogOpen, hasPromotionTarget, refreshPromotionPlan, selectedFlowId]);

  useSchemaRepairs({
    projectId,
    envId: dialogOpen ? selectedPlan?.targetEnvironment?.id : null,
    enabled: dialogOpen && Boolean(selectedPlan?.targetEnvironment?.id),
    onRepair: (repair) => {
      if (
        !dialogOpen ||
        !selectedPlan?.targetEnvironment ||
        repair.environmentId !== selectedPlan.targetEnvironment.id
      ) {
        return;
      }

      const key = selectedPlanKey;
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        refreshPromotionPlan({
          key,
          flowId: selectedFlowId,
          refreshingKey: true,
          errorMessage: '同步最新提升预检失败',
        });
      }, 180);
    },
  });

  const handlePromote = async () => {
    if (promoting) return;
    const planKey = getPromotionPlanKey(selectedFlowId);
    if (!loadedPlanKeys.has(planKey)) {
      toast.error('实时预检还没有完成，请稍等一下');
      return;
    }

    setPromoting(true);

    try {
      const data = await createPromotionRelease({
        projectId,
        flowId: selectedFlowId,
      });

      toast.success(
        data.tagName
          ? `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'} · 成功后写入 ${data.tagName}`
          : `已创建提升发布 · ${data.targetEnvironmentName ?? '目标环境'}`
      );
      setDialogOpen(false);

      if (data.releasePath) {
        router.push(data.releasePath);
        return;
      }

      if (data.releaseId && data.targetEnvironmentId) {
        router.push(buildReleaseDetailPath(projectId, data.targetEnvironmentId, data.releaseId));
        return;
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建提升发布失败');
    } finally {
      setPromoting(false);
    }
  };

  if (!hasPromotionTarget) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className={className}
        onClick={() => setDialogOpen(true)}
        disabled={promoting || !governance.promotion.allowed}
        title={buttonTitle}
      >
        <ArrowUpCircle className="h-3.5 w-3.5" />
        {buttonLabel}
      </Button>

      <ReleasePromoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promotionPlans={activePromotionPlans}
        selectedFlowId={selectedFlowId}
        onSelectedFlowIdChange={setSelectedFlowId}
        canPromote={canPromote}
        promoting={promoting}
        loadingPlan={loadingPlan}
        refreshingPlan={refreshingPlan}
        planError={selectedPlanError}
        onPromote={handlePromote}
      />
    </>
  );
}
