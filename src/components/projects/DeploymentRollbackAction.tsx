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
          setError(fetchError instanceof Error ? fetchError.message : '加载回滚预检失败');
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
        router.push(`/projects/${projectId}/releases/${data.releaseId}`);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>回滚预检</DialogTitle>
          <DialogDescription>
            平台会先评估环境保护、迁移和阻断条件，再创建新的回滚 release。
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
              正在加载回滚预检...
            </div>
          ) : planningPanel ? (
            <>
              <PlatformSignalChipList chips={planningPanel.chips} />
              <PlatformSignalSummary
                summary={planningPanel.issueSummary}
                nextActionLabel={planningPanel.nextActionLabel}
              />

              {planningPanel.sourceImageUrl && (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                  {planningPanel.sourceImageUrl}
                </div>
              )}

              {planningPanel.blockingReason && (
                <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                  {planningPanel.blockingReason}
                </div>
              )}

              {!planningPanel.blockingReason && planningPanel.warningChips.length > 0 && (
                <PlatformSignalChipList chips={planningPanel.warningChips} />
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
