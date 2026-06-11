'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogFooterAction,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSignalBlock, PlatformSignalChipList } from '@/components/ui/platform-signals';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createEnvironmentRollbackRelease,
  type EnvironmentRollbackCandidateResponse,
  type EnvironmentRollbackPlanResponse,
  fetchEnvironmentRollbackPlan,
  ReleaseClientActionError,
} from '@/lib/releases/client-actions';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import { formatPlatformTimeContext } from '@/lib/time/format';
import { cn } from '@/lib/utils';

const dialogPanelClassName = 'console-panel p-5 sm:p-6';
const dialogSubtleClassName = 'console-inset px-4 py-3';

function getCandidateLabel(candidate: EnvironmentRollbackCandidateResponse): string {
  const shortSha = candidate.sourceCommitSha?.slice(0, 7);
  const createdAt = formatPlatformTimeContext(candidate.createdAt);
  return [shortSha ?? candidate.sourceRef, createdAt].filter(Boolean).join(' · ');
}

function formatImageLabel(imageUrl: string): string {
  const imageName = imageUrl.split('/').pop() ?? imageUrl;
  const [repository, tag] = imageName.split(':');
  if (!tag) return repository;
  return `${repository}:${tag}`;
}

interface EnvironmentRollbackActionProps {
  projectId: string;
  environmentId: string;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function EnvironmentRollbackAction({
  projectId,
  environmentId,
  disabled = false,
  disabledSummary,
}: EnvironmentRollbackActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<EnvironmentRollbackPlanResponse | null>(null);

  const loadPlan = useCallback(
    async (sourceReleaseId?: string | null, syncSelection = false) => {
      setLoadingPlan(true);
      setError(null);

      try {
        const data = await fetchEnvironmentRollbackPlan({
          projectId,
          environmentId,
          sourceReleaseId,
        });
        setPlan(data);

        if (syncSelection) {
          setSelectedReleaseId(data.sourceRelease?.id ?? data.candidates[0]?.id ?? null);
        }

        return data;
      } catch (requestError) {
        setPlan(null);
        setError(requestError instanceof Error ? requestError.message : '加载回滚检查失败');
        return null;
      } finally {
        setLoadingPlan(false);
      }
    },
    [environmentId, projectId]
  );

  const selectedCandidate = useMemo(
    () => plan?.candidates.find((candidate) => candidate.id === selectedReleaseId) ?? null,
    [plan?.candidates, selectedReleaseId]
  );
  const selectedArtifacts = selectedCandidate?.artifacts ?? plan?.sourceRelease?.artifacts ?? [];
  const planningPanel = plan
    ? buildReleasePlanningPanel({
        plan: plan.plan,
        sourceCommitSha: plan.sourceRelease?.sourceCommitSha,
      })
    : null;

  const handleSelectRelease = (releaseId: string) => {
    setSelectedReleaseId(releaseId);
    void loadPlan(releaseId, false);
  };

  const handleOpenRollback = async () => {
    const data = await loadPlan(null, true);
    if (data) {
      setOpen(true);
      return;
    }

    toast.error('加载回滚检查失败');
  };

  const handleRollback = async () => {
    if (!selectedReleaseId) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await createEnvironmentRollbackRelease({
        projectId,
        environmentId,
        sourceReleaseId: selectedReleaseId,
      });

      setOpen(false);
      toast.success('回滚发布已创建');

      if (data.releasePath) {
        router.push(data.releasePath);
        return;
      }

      if (data.releaseId) {
        router.push(buildReleaseDetailPath(projectId, environmentId, data.releaseId));
        return;
      }

      router.refresh();
    } catch (submitError) {
      if (submitError instanceof ReleaseClientActionError && submitError.releasePath) {
        setOpen(false);
        toast.error(submitError.message);
        router.push(submitError.releasePath);
        return;
      }

      setError(submitError instanceof Error ? submitError.message : '创建回滚失败');
    } finally {
      setSubmitting(false);
    }
  };

  const unavailableReason =
    disabledSummary ??
    plan?.plan.blockingReason ??
    (plan?.candidates.length === 0 ? '暂无可回滚版本' : null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-4"
        disabled={disabled || loadingPlan}
        title={disabled ? (unavailableReason ?? undefined) : undefined}
        onClick={handleOpenRollback}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {loadingPlan && !open ? '检查中...' : '回滚'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="form" layout="form">
          <DialogHeader chrome>
            <DialogTitle>回滚</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className={dialogPanelClassName}>
                  <div className="text-sm font-semibold text-foreground">目标版本</div>
                  <div className="mt-4">
                    <Select
                      value={selectedReleaseId ?? ''}
                      onValueChange={handleSelectRelease}
                      disabled={loadingPlan || submitting || (plan?.candidates.length ?? 0) === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择成功 release" />
                      </SelectTrigger>
                      <SelectContent>
                        {(plan?.candidates ?? []).map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {getCandidateLabel(candidate)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedArtifacts.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedArtifacts.map((artifact) => (
                        <Badge
                          key={artifact.service.id}
                          variant="secondary"
                          className="max-w-full gap-1 rounded-full px-2 py-0.5 font-normal"
                        >
                          <span className="shrink-0 font-medium">{artifact.service.name}</span>
                          <span className="truncate text-muted-foreground">
                            {formatImageLabel(artifact.imageUrl)}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className={dialogPanelClassName}>
                  <div className="mb-3 text-sm font-semibold text-foreground">执行条件</div>

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
            <DialogFooterAction variant="ghost" onClick={() => setOpen(false)}>
              关闭
            </DialogFooterAction>
            <DialogFooterAction
              onClick={handleRollback}
              disabled={
                submitting || loadingPlan || !selectedReleaseId || !planningPanel?.canSubmit
              }
            >
              {submitting ? '创建中...' : '确认回滚'}
            </DialogFooterAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
