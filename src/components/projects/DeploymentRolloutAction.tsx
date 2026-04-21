'use client';

import { ArrowRightLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSignalBlock } from '@/components/ui/platform-signals';
import {
  type DeploymentRolloutPlanResponse,
  fetchDeploymentRolloutPlan,
  finalizeDeploymentRolloutAction,
} from '@/lib/releases/client-actions';
import { cn } from '@/lib/utils';

interface DeploymentRolloutActionProps {
  projectId: string;
  deploymentId: string;
  strategyLabel?: string | null;
  disabled?: boolean;
  disabledSummary?: string | null;
}

function getRolloutActionLabel(strategyLabel?: string | null): string {
  if (strategyLabel?.includes('蓝绿')) return '完成切换';
  return '完成放量';
}

const dialogPanelClassName =
  'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)] sm:p-6';
const dialogSubtleClassName =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]';

export function DeploymentRolloutAction({
  projectId,
  deploymentId,
  strategyLabel,
  disabled = false,
  disabledSummary,
}: DeploymentRolloutActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DeploymentRolloutPlanResponse | null>(null);

  const actionLabel = useMemo(
    () => getRolloutActionLabel(plan?.plan.strategyLabel ?? strategyLabel),
    [plan?.plan.strategyLabel, strategyLabel]
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingPlan(true);
    setError(null);

    fetchDeploymentRolloutPlan({ projectId, deploymentId })
      .then((data) => {
        if (!cancelled) {
          setPlan(data);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : '加载放量检查失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deploymentId, open, projectId]);

  const handleFinalize = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await finalizeDeploymentRolloutAction({ projectId, deploymentId });
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '推进放量失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3"
          disabled={disabled}
          title={disabled ? (disabledSummary ?? undefined) : undefined}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        size="workspace"
        className="flex max-h-[calc(100vh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[95vh]"
      >
        <DialogHeader className="shrink-0 px-5 py-6 sm:px-8 sm:py-7">
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>确认后继续。</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)]">
            <div className="space-y-4">
              {disabledSummary && (
                <div className="rounded-[20px] bg-[rgba(243,240,233,0.66)] px-4 py-3 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
                  {disabledSummary}
                </div>
              )}

              <div className={dialogPanelClassName}>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">候选切换上下文</div>
                  <div className="text-sm text-muted-foreground">确认候选版本。</div>
                </div>

                {plan?.deployment?.candidateImage ? (
                  <div className={cn(dialogSubtleClassName, 'mt-4')}>
                    <div className="text-xs text-muted-foreground">候选版本镜像</div>
                    <code className="mt-2 block break-all text-xs text-foreground">
                      {plan.deployment.candidateImage}
                    </code>
                  </div>
                ) : (
                  <EmptyState title="暂无候选镜像" className="mt-4 min-h-40 rounded-[20px]" />
                )}
              </div>

              {error ? (
                <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>{error}</div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="mb-3 space-y-1">
                  <div className="text-sm font-semibold text-foreground">放量检查</div>
                  <div className="text-sm text-muted-foreground">通过后继续。</div>
                </div>

                {loadingPlan ? (
                  <EmptyState title="加载中" className="min-h-40 rounded-[20px]" />
                ) : plan ? (
                  <div className="space-y-3">
                    <PlatformSignalBlock
                      chips={plan.plan.platformSignals.chips}
                      summary={plan.plan.platformSignals.primarySummary}
                      nextActionLabel={plan.plan.platformSignals.nextActionLabel}
                      summaryClassName="rounded-[20px]"
                    />

                    {plan.plan.blockingReason ? (
                      <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>
                        {plan.plan.blockingReason}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState title="暂无结果" className="min-h-40 rounded-[20px]" />
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="console-divider-top shrink-0 bg-background/88 px-5 py-4 backdrop-blur sm:px-8">
          <Button
            variant="ghost"
            className="w-full rounded-full sm:w-auto"
            onClick={() => setOpen(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full rounded-full sm:w-auto"
            onClick={handleFinalize}
            disabled={submitting || loadingPlan || !plan?.plan.canFinalize}
          >
            {submitting ? '处理中...' : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
