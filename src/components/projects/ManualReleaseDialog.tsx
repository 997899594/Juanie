'use client';

import { Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';

interface ManualReleaseEnvironment {
  id: string;
  name: string;
  isProduction: boolean;
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
  releasePolicy: {
    requiresApproval: boolean;
  };
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    warnings: string[];
  };
}

interface ManualReleaseDialogProps {
  projectId: string;
  environments: ManualReleaseEnvironment[];
  releases: ManualReleaseSource[];
  onCreated?: () => Promise<void> | void;
}

export function ManualReleaseDialog({
  projectId,
  environments,
  releases,
  onCreated,
}: ManualReleaseDialogProps) {
  const router = useRouter();
  const successfulSources = useMemo(
    () => releases.filter((release) => release.artifacts.length > 0),
    [releases]
  );
  const defaultEnvironmentId =
    environments.find((environment) => !environment.isProduction)?.id ?? environments[0]?.id ?? '';
  const defaultSourceId = successfulSources[0]?.id ?? '';

  const [open, setOpen] = useState(false);
  const [environmentId, setEnvironmentId] = useState(defaultEnvironmentId);
  const [sourceReleaseId, setSourceReleaseId] = useState(defaultSourceId);
  const [summary, setSummary] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<ManualReleasePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    fetch(`/api/projects/${projectId}/deployments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dryRun: true,
        environmentId,
        ref: sourceRelease.sourceRef,
        commitSha: sourceRelease.sourceCommitSha,
        commitMessage: summary || sourceRelease.summary || null,
        services: sourceRelease.artifacts.map((artifact) => ({
          id: artifact.service.id,
          name: artifact.service.name,
          image: artifact.imageUrl,
          digest: artifact.imageDigest ?? null,
        })),
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || '加载发布预检失败');
        }
        if (!cancelled) {
          setPlan(data?.plan ?? null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : '加载发布预检失败');
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

  const handleCreate = async () => {
    const sourceRelease = successfulSources.find((release) => release.id === sourceReleaseId);
    if (!sourceRelease) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environmentId,
          ref: sourceRelease.sourceRef,
          commitSha: sourceRelease.sourceCommitSha,
          commitMessage: summary || sourceRelease.summary || null,
        services: sourceRelease.artifacts.map((artifact) => ({
            id: artifact.service.id,
            name: artifact.service.name,
            image: artifact.imageUrl,
            digest: artifact.imageDigest ?? null,
          })),
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || '创建手动发布失败');
      }

      setOpen(false);
      await onCreated?.();
      if (data?.id) {
        router.push(`/projects/${projectId}/releases/${data.id}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建手动发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl px-4">
          <Rocket className="h-3.5 w-3.5" />
          手动发布
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>手动发布</DialogTitle>
          <DialogDescription>从已有 release 复用镜像，先预检再创建新的 release。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <Label>来源 release</Label>
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

          <div className="space-y-2">
            <Label>摘要</Label>
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="可选。默认沿用来源 release 摘要。"
              className="min-h-[88px]"
            />
          </div>

          {loadingPlan ? (
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
              正在加载发布预检...
            </div>
          ) : plan ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {plan.summary && (
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                    {plan.summary}
                  </span>
                )}
                {plan.releasePolicy.requiresApproval && (
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                    需要审批
                  </span>
                )}
                {plan.migration.preDeployCount > 0 && (
                  <Badge variant="outline">前置迁移 {plan.migration.preDeployCount} 项</Badge>
                )}
                {plan.migration.postDeployCount > 0 && (
                  <Badge variant="outline">后置迁移 {plan.migration.postDeployCount} 项</Badge>
                )}
              </div>

              {plan.blockingReason && (
                <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                  {plan.blockingReason}
                </div>
              )}

              {!plan.blockingReason && plan.migration.warnings.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {plan.migration.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-foreground"
                    >
                      {warning}
                    </span>
                  ))}
                </div>
              )}
            </div>
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
            onClick={handleCreate}
            disabled={
              submitting ||
              loadingPlan ||
              !plan?.canCreate ||
              !!plan?.blockingReason ||
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
