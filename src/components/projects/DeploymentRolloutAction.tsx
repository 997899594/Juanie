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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            平台会检查候选版本和当前流量策略，确认后将候选版本切为正式版本。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {disabledSummary && (
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
              {disabledSummary}
            </div>
          )}

          {loadingPlan ? (
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
              正在加载放量预检...
            </div>
          ) : plan ? (
            <>
              <PlatformSignalChipList chips={plan.plan.platformSignals.chips} />
              <PlatformSignalSummary
                summary={plan.plan.platformSignals.primarySummary}
                nextActionLabel={plan.plan.platformSignals.nextActionLabel}
              />

              {plan.deployment?.candidateImage && (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                  候选版本：{plan.deployment.candidateImage}
                </div>
              )}

              {plan.plan.blockingReason && (
                <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                  {plan.plan.blockingReason}
                </div>
              )}
            </>
          ) : null}

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
          <Button
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
