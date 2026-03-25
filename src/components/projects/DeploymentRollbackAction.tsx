'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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

interface RollbackPlanResponse {
  sourceDeployment: {
    id: string;
    imageUrl: string;
    commitSha: string | null;
    environmentId: string;
    serviceId: string | null;
    branch: string | null;
  } | null;
  plan: {
    canCreate: boolean;
    blockingReason: string | null;
    summary: string | null;
    releasePolicy: {
      requiresApproval: boolean;
    };
    migration: {
      preDeployCount: number;
      postDeployCount: number;
      warnings: string[];
    };
  };
}

interface DeploymentRollbackActionProps {
  projectId: string;
  deploymentId: string;
}

export function DeploymentRollbackAction({
  projectId,
  deploymentId,
}: DeploymentRollbackActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RollbackPlanResponse | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingPlan(true);
    setError(null);

    fetch(`/api/projects/${projectId}/deployments/${deploymentId}/rollback`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || '加载回滚预检失败');
        }
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
      const response = await fetch(
        `/api/projects/${projectId}/deployments/${deploymentId}/rollback`,
        {
          method: 'POST',
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || '创建回滚发布失败');
      }

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
        <Button variant="outline" size="sm" className="h-8 rounded-xl px-3">
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
          {loadingPlan ? (
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
              正在加载回滚预检...
            </div>
          ) : plan ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {plan.plan.summary && (
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                    {plan.plan.summary}
                  </span>
                )}
                {plan.plan.releasePolicy.requiresApproval && (
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                    需要审批
                  </span>
                )}
                {plan.plan.migration.preDeployCount > 0 && (
                  <Badge variant="outline">前置迁移 {plan.plan.migration.preDeployCount} 项</Badge>
                )}
                {plan.plan.migration.postDeployCount > 0 && (
                  <Badge variant="outline">后置迁移 {plan.plan.migration.postDeployCount} 项</Badge>
                )}
                {plan.sourceDeployment?.commitSha && (
                  <Badge variant="outline">
                    来源 {plan.sourceDeployment.commitSha.slice(0, 7)}
                  </Badge>
                )}
              </div>

              {plan.sourceDeployment?.imageUrl && (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                  {plan.sourceDeployment.imageUrl}
                </div>
              )}

              {plan.plan.blockingReason && (
                <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                  {plan.plan.blockingReason}
                </div>
              )}

              {!plan.plan.blockingReason && plan.plan.migration.warnings.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {plan.plan.migration.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-foreground"
                    >
                      {warning}
                    </span>
                  ))}
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
            onClick={handleRollback}
            disabled={
              submitting || loadingPlan || !plan?.plan.canCreate || !!plan?.plan.blockingReason
            }
          >
            {submitting ? '创建中...' : '确认回滚'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
