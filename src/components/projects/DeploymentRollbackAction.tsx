'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { PlatformSignalBlock, PlatformSignalChipList } from '@/components/ui/platform-signals';
import {
  createRollbackRelease,
  fetchRollbackPlan,
  type RollbackPlanResponse,
} from '@/lib/releases/client-actions';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import { cn } from '@/lib/utils';

const dialogPanelClassName =
  'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)] sm:p-6';
const dialogSubtleClassName =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]';

interface DeploymentRollbackActionProps {
  projectId: string;
  environmentId: string;
  deploymentId: string;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function DeploymentRollbackAction({
  projectId,
  environmentId,
  deploymentId,
  disabled = false,
  disabledSummary,
}: DeploymentRollbackActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RollbackPlanResponse | null>(null);
  const planningPanel = plan
    ? buildReleasePlanningPanel({
        plan: plan.plan,
        sourceCommitSha: plan.sourceDeployment?.commitSha,
        sourceImageUrl: plan.sourceDeployment?.imageUrl,
      })
    : null;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingPlan(true);
    setError(null);

    fetchRollbackPlan({ projectId, deploymentId })
      .then((data) => {
        if (!cancelled) {
          setPlan(data);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : '加载回滚检查失败');
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

  const handleRollback = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const data = await createRollbackRelease({ projectId, deploymentId });

      setOpen(false);
      if (data?.releaseId) {
        router.push(buildReleaseDetailPath(projectId, environmentId, data.releaseId));
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建回滚发布失败');
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
          <RotateCcw className="h-3.5 w-3.5" />
          回滚
        </Button>
      </DialogTrigger>
      <DialogContent
        size="workspace"
        className="flex max-h-[calc(100vh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[95vh]"
      >
        <DialogHeader className="shrink-0 px-5 py-6 sm:px-8 sm:py-7">
          <DialogTitle>回滚检查</DialogTitle>
          <DialogDescription>确认后回滚。</DialogDescription>
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
                  <div className="text-sm font-semibold text-foreground">回滚来源</div>
                  <div className="text-sm text-muted-foreground">确认回滚版本。</div>
                </div>

                {planningPanel?.sourceImageUrl ? (
                  <div className={cn(dialogSubtleClassName, 'mt-4')}>
                    <div className="text-xs text-muted-foreground">来源镜像</div>
                    <code className="mt-2 block break-all text-xs text-foreground">
                      {planningPanel.sourceImageUrl}
                    </code>
                  </div>
                ) : (
                  <EmptyState title="暂无来源镜像" className="mt-4 min-h-40 rounded-[20px]" />
                )}
              </div>

              {error ? (
                <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>{error}</div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="mb-3 space-y-1">
                  <div className="text-sm font-semibold text-foreground">回滚检查</div>
                  <div className="text-sm text-muted-foreground">有阻断则不可回滚。</div>
                </div>

                {loadingPlan ? (
                  <EmptyState title="加载中" className="min-h-40 rounded-[20px]" />
                ) : planningPanel ? (
                  <div className="space-y-3">
                    <PlatformSignalBlock
                      chips={planningPanel.chips}
                      summary={planningPanel.issueSummary}
                      nextActionLabel={planningPanel.nextActionLabel}
                      summaryClassName="rounded-[20px]"
                    />

                    {planningPanel.blockingReason ? (
                      <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>
                        {planningPanel.blockingReason}
                      </div>
                    ) : null}

                    {!planningPanel.blockingReason && planningPanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={planningPanel.warningChips} />
                    )}
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
            onClick={handleRollback}
            disabled={submitting || loadingPlan || !planningPanel?.canSubmit}
          >
            {submitting ? '创建中...' : '确认回滚'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
