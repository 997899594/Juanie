'use client';

import { ArrowRightLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlatformSignalChipList, PlatformSignalSummary } from '@/components/ui/platform-signals';
import {
  type DeploymentRolloutPlanResponse,
  fetchDeploymentRolloutPlan,
  finalizeDeploymentRolloutAction,
} from '@/lib/releases/client-actions';

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
          setError(fetchError instanceof Error ? fetchError.message : '加载放量预检失败');
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
          variant="outline"
          size="sm"
          className="h-8 rounded-xl px-3"
          disabled={disabled}
          title={disabled ? (disabledSummary ?? undefined) : undefined}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-5 sm:px-6">
          <DialogTitle>{actionLabel}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div className="space-y-4">
              {disabledSummary && (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                  {disabledSummary}
                </div>
              )}

              <div className="rounded-[24px] border border-border bg-background p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">候选切换上下文</div>
                </div>

                {plan?.deployment?.candidateImage ? (
                  <div className="mt-4 rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                    <div className="text-xs text-muted-foreground">候选版本镜像</div>
                    <code className="mt-2 block break-all text-xs text-foreground">
                      {plan.deployment.candidateImage}
                    </code>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/10 px-4 py-8 text-sm text-muted-foreground">
                    暂无候选镜像
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-border bg-background p-4 sm:p-5">
                <div className="mb-3 text-sm font-semibold text-foreground">放量预检</div>

                {loadingPlan ? (
                  <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
                    正在加载放量预检...
                  </div>
                ) : plan ? (
                  <div className="space-y-3">
                    <PlatformSignalChipList chips={plan.plan.platformSignals.chips} />
                    <PlatformSignalSummary
                      summary={plan.plan.platformSignals.primarySummary}
                      nextActionLabel={plan.plan.platformSignals.nextActionLabel}
                    />

                    {plan.plan.blockingReason && (
                      <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                        {plan.plan.blockingReason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/10 px-4 py-8 text-sm text-muted-foreground">
                    暂无预检
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 bg-background px-4 py-4 sm:px-6">
          <Button
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => setOpen(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full rounded-xl sm:w-auto"
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
