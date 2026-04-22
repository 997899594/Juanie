'use client';

import { Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { PlatformSignalBlock, PlatformSignalChipList } from '@/components/ui/platform-signals';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createManualRelease, fetchManualReleasePlan } from '@/lib/releases/client-actions';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { cn } from '@/lib/utils';

interface ManualReleaseEnvironment {
  id: string;
  name: string;
  kind?: 'production' | 'persistent' | 'preview' | null;
  isProduction: boolean;
  scopeLabel?: string | null;
  sourceLabel?: string | null;
}

interface ManualReleaseSource {
  id: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  summary?: string | null;
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
    imageDigest?: string | null;
  }>;
}

interface ManualReleasePlan {
  canCreate: boolean;
  blockingReason: string | null;
  summary: string | null;
  issue: {
    code: string;
    kind: 'approval' | 'migration' | 'deployment' | 'environment' | 'release';
    label: string;
    summary: string;
    nextActionLabel: string;
  } | null;
  platformSignals: {
    chips: Array<{
      key: string;
      label: string;
      tone: 'danger' | 'neutral';
    }>;
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  releasePolicy: {
    requiresApproval: boolean;
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  environmentPolicy: {
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    automaticCount: number;
    manualPlatformCount: number;
    externalCount: number;
    warnings: string[];
    requiresExternalCompletion?: boolean;
    primarySignal: {
      code: string;
      kind: 'migration';
      level: 'warning' | 'approval_required';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  schema: {
    checkedCount: number;
    blockingCount: number;
    summary: string | null;
    nextActionLabel: string | null;
  };
}

interface ManualReleaseDialogProps {
  projectId: string;
  environments: ManualReleaseEnvironment[];
  releases: ManualReleaseSource[];
  disabledSummary?: string | null;
  onCreated?: () => Promise<void> | void;
}

const dialogPanelClassName =
  'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)] sm:p-6';
const dialogSubtleClassName =
  'rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

export function ManualReleaseDialog({
  projectId,
  environments,
  releases,
  disabledSummary,
  onCreated,
}: ManualReleaseDialogProps) {
  const router = useRouter();
  const successfulSources = useMemo(
    () => releases.filter((release) => release.artifacts.length > 0),
    [releases]
  );
  const unavailableReason =
    environments.length === 0
      ? (disabledSummary ?? '没有环境')
      : successfulSources.length === 0
        ? '没有可复用发布'
        : null;
  const defaultEnvironmentId =
    environments.find((environment) => environment.kind !== 'production')?.id ??
    environments[0]?.id ??
    '';
  const defaultSourceId = successfulSources[0]?.id ?? '';

  const [open, setOpen] = useState(false);
  const [environmentId, setEnvironmentId] = useState(defaultEnvironmentId);
  const [sourceReleaseId, setSourceReleaseId] = useState(defaultSourceId);
  const [summary, setSummary] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<ManualReleasePlan | null>(null);

  useEffect(() => {
    if (!environmentId && defaultEnvironmentId) {
      setEnvironmentId(defaultEnvironmentId);
    }
  }, [defaultEnvironmentId, environmentId]);

  useEffect(() => {
    if (!sourceReleaseId && defaultSourceId) {
      setSourceReleaseId(defaultSourceId);
    }
  }, [defaultSourceId, sourceReleaseId]);

  useEffect(() => {
    if (!open) return;
    if (!environmentId || !sourceReleaseId) {
      setPlan(null);
      return;
    }

    const sourceRelease = successfulSources.find((release) => release.id === sourceReleaseId);
    if (!sourceRelease) {
      setPlan(null);
      return;
    }

    let cancelled = false;
    setLoadingPlan(true);

    fetchManualReleasePlan({
      projectId,
      environmentId,
      sourceRef: sourceRelease.sourceRef,
      sourceCommitSha: sourceRelease.sourceCommitSha,
      summary: summary || sourceRelease.summary || null,
      services: sourceRelease.artifacts.map((artifact) => ({
        id: artifact.service.id,
        name: artifact.service.name,
        image: artifact.imageUrl,
        digest: artifact.imageDigest ?? null,
      })),
    })
      .then((data) => {
        if (!cancelled) {
          setPlan(data?.plan ?? null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          toast.error(requestError instanceof Error ? requestError.message : '加载发布检查失败');
          setPlan(null);
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
  }, [environmentId, open, projectId, sourceReleaseId, successfulSources, summary]);

  const selectedSourceRelease =
    successfulSources.find((release) => release.id === sourceReleaseId) ?? null;
  const planningPanel = plan
    ? buildReleasePlanningPanel({
        plan,
        sourceCommitSha: selectedSourceRelease?.sourceCommitSha,
      })
    : null;
  const selectedArtifacts = selectedSourceRelease?.artifacts ?? [];

  const handleCreate = async () => {
    const sourceRelease = selectedSourceRelease;
    if (!sourceRelease) return;

    setSubmitting(true);

    try {
      const data = await createManualRelease({
        environmentId,
        projectId,
        sourceReleaseId: sourceRelease.id,
        sourceRef: sourceRelease.sourceRef,
        sourceCommitSha: sourceRelease.sourceCommitSha,
        summary: summary || sourceRelease.summary || null,
        services: sourceRelease.artifacts.map((artifact) => ({
          id: artifact.service.id,
          name: artifact.service.name,
          image: artifact.imageUrl,
          digest: artifact.imageDigest ?? null,
        })),
      });

      setOpen(false);
      toast.success('手动发布已创建');
      await onCreated?.();
      if (data?.id) {
        router.push(buildReleaseDetailPath(projectId, environmentId, data.id));
        router.refresh();
      }
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : '创建手动发布失败');
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
          className="rounded-full px-4"
          disabled={Boolean(unavailableReason)}
          title={unavailableReason ?? undefined}
        >
          <Rocket className="h-3.5 w-3.5" />
          手动发布
        </Button>
      </DialogTrigger>
      <DialogContent
        size="workspace"
        className="flex max-h-[calc(100vh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[95vh]"
      >
        <DialogHeader className="shrink-0 px-5 py-6 sm:px-8 sm:py-7">
          <DialogTitle>手动发布</DialogTitle>
          <DialogDescription>
            复用已经构建成功的产物，直接发到目标环境，不改动源码分支。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_minmax(420px,0.84fr)]">
            <div className="space-y-4">
              {disabledSummary && environments.length > 0 && (
                <div className="rounded-[20px] bg-[rgba(243,240,233,0.66)] px-4 py-3 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
                  {disabledSummary}
                </div>
              )}

              <div className={dialogPanelClassName}>
                <div className="mb-5 text-sm font-semibold text-foreground">发布配置</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>目标环境</Label>
                    <Select value={environmentId} onValueChange={setEnvironmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择环境" />
                      </SelectTrigger>
                      <SelectContent>
                        {environments.map((environment) => (
                          <SelectItem key={environment.id} value={environment.id}>
                            {environment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>来源发布</Label>
                    <Select value={sourceReleaseId} onValueChange={setSourceReleaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择来源" />
                      </SelectTrigger>
                      <SelectContent>
                        {successfulSources.map((release) => (
                          <SelectItem key={release.id} value={release.id}>
                            {getReleaseDisplayTitle(release)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>发布摘要</Label>
                  <Textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="可留空"
                    className="min-h-[112px]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">来源</div>
                  {selectedArtifacts.length > 0 && (
                    <div className="inline-flex items-center rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {selectedArtifacts.length} 个服务
                    </div>
                  )}
                </div>

                {selectedSourceRelease ? (
                  <div className="space-y-3 text-sm">
                    <div className={dialogSubtleClassName}>
                      <div className="text-xs text-muted-foreground">来源标识</div>
                      <div className="mt-1 break-all font-medium text-foreground">
                        {selectedSourceRelease.sourceRef}
                      </div>
                      {selectedSourceRelease.sourceCommitSha && (
                        <code className="mt-2 inline-flex rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
                          {selectedSourceRelease.sourceCommitSha.slice(0, 12)}
                        </code>
                      )}
                    </div>

                    <div className={cn(dialogSubtleClassName, 'space-y-2')}>
                      <div className="text-xs text-muted-foreground">包含服务</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedArtifacts.map((artifact) => (
                          <span
                            key={artifact.service.id}
                            className="inline-flex items-center rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                          >
                            {artifact.service.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {(summary || selectedSourceRelease.summary) && (
                      <div className={dialogSubtleClassName}>
                        <div className="text-xs text-muted-foreground">最终摘要</div>
                        <div className="mt-1 text-sm leading-6 text-foreground">
                          {summary || selectedSourceRelease.summary}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState title="选择来源" className="min-h-40 rounded-[20px]" />
                )}
              </div>

              <div className={dialogPanelClassName}>
                <div className="mb-3 text-sm font-semibold text-foreground">检查</div>

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

                    {!planningPanel.blockingReason && planningPanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={planningPanel.warningChips} />
                    )}
                  </div>
                ) : (
                  <EmptyState title="选择来源后查看" className="min-h-40 rounded-[20px]" />
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
            onClick={handleCreate}
            disabled={
              submitting ||
              loadingPlan ||
              !planningPanel?.canSubmit ||
              !environmentId ||
              !sourceReleaseId
            }
          >
            {submitting ? '创建中...' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
