'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
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

const dialogPanelClassName = 'console-panel p-5 sm:p-6';
const dialogSubtleClassName = 'console-inset px-4 py-3';

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
      <DialogContent size="form" layout="form">
        <DialogHeader chrome>
          <DialogTitle>回滚检查</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {disabledSummary && (
                <div className="console-inset rounded-[20px] px-4 py-3 text-sm text-muted-foreground">
                  {disabledSummary}
                </div>
              )}

              <div className={dialogPanelClassName}>
                <div className="text-sm font-semibold text-foreground">回滚来源</div>

                {planningPanel?.sourceImageUrl ? (
                  <div className={cn(dialogSubtleClassName, 'mt-4')}>
                    <code className="mt-2 block break-all text-xs text-foreground">
                      {planningPanel.sourceImageUrl}
                    </code>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>{error}</div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="mb-3 text-sm font-semibold text-foreground">回滚检查</div>

                {loadingPlan ? (
                  <EmptyState title="检查中" className="min-h-28 rounded-[20px]" />
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
                  <EmptyState title="暂无检查结果" className="min-h-28 rounded-[20px]" />
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter chrome>
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
