'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  createRollbackRelease,
  fetchRollbackPlan,
  type RollbackPlanResponse,
} from '@/lib/releases/client-actions';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';

interface DeploymentRollbackActionProps {
  projectId: string;
  deploymentId: string;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function DeploymentRollbackAction({
  projectId,
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
        router.push(`/projects/${projectId}/delivery/${data.releaseId}`);
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
          variant="outline"
          size="sm"
          className="h-8 rounded-xl px-3"
          disabled={disabled}
          title={disabled ? (disabledSummary ?? undefined) : undefined}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          回滚
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
          <DialogTitle>回滚检查</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div className="space-y-4">
              {disabledSummary && (
                <div className="console-card rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  {disabledSummary}
                </div>
              )}

              <div className="console-surface p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">回滚来源</div>
                </div>

                {planningPanel?.sourceImageUrl ? (
                  <div className="console-card mt-4 rounded-2xl px-4 py-3">
                    <div className="text-xs text-muted-foreground">来源镜像</div>
                    <code className="mt-2 block break-all text-xs text-foreground">
                      {planningPanel.sourceImageUrl}
                    </code>
                  </div>
                ) : (
                  <div className="console-card mt-4 rounded-2xl px-4 py-8 text-sm text-muted-foreground">
                    暂无来源镜像
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl bg-destructive/[0.06] px-4 py-3 text-sm text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="console-surface p-4 sm:p-5">
                <div className="mb-3 text-sm font-semibold text-foreground">回滚检查</div>

                {loadingPlan ? (
                  <div className="console-card rounded-2xl px-4 py-8 text-sm text-muted-foreground">
                    加载中...
                  </div>
                ) : planningPanel ? (
                  <div className="space-y-3">
                    <PlatformSignalChipList chips={planningPanel.chips} />
                    <PlatformSignalSummary
                      summary={planningPanel.issueSummary}
                      nextActionLabel={planningPanel.nextActionLabel}
                    />

                    {planningPanel.blockingReason && (
                      <div className="rounded-2xl bg-destructive/[0.06] px-4 py-3 text-sm text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
                        {planningPanel.blockingReason}
                      </div>
                    )}

                    {!planningPanel.blockingReason && planningPanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={planningPanel.warningChips} />
                    )}
                  </div>
                ) : (
                  <div className="console-card rounded-2xl px-4 py-8 text-sm text-muted-foreground">
                    暂无结果
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
          <Button
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => setOpen(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full rounded-xl sm:w-auto"
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
