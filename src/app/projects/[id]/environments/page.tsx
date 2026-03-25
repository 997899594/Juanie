'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock3,
  GitBranch,
  Globe,
  Plus,
  Trash2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  formatEnvironmentExpiry,
  formatEnvironmentTimestamp,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  order: number;
  namespace: string | null;
  isProduction: boolean;
  autoDeploy: boolean;
  branch: string | null;
  isPreview: boolean;
  previewPrNumber: number | null;
  expiresAt: string | null;
  domains: Array<{
    id: string;
    hostname: string;
    isVerified: boolean | null;
    serviceId: string | null;
    service?: {
      id: string;
      name: string;
    } | null;
  }>;
  policy: {
    level: 'normal' | 'protected' | 'preview';
    reasons: string[];
    summary: string | null;
  };
}

interface PreviewDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { branch: string; prNumber: string; ttlHours: string }) => Promise<void>;
}

function PreviewEnvironmentDialog({
  open,
  loading,
  error,
  onOpenChange,
  onSubmit,
}: PreviewDialogProps) {
  const [branch, setBranch] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [ttlHours, setTtlHours] = useState('72');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ branch, prNumber, ttlHours });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建预览环境</DialogTitle>
          <DialogDescription>
            输入分支或 PR 号。平台会创建或续期对应的预览环境，并沿用现有 release 流程发布。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preview-branch">分支</Label>
              <Input
                id="preview-branch"
                placeholder="feature/release-intel"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-pr">PR 号</Label>
              <Input
                id="preview-pr"
                inputMode="numeric"
                placeholder="42"
                value={prNumber}
                onChange={(event) => setPrNumber(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preview-ttl">保留时长（小时）</Label>
            <Input
              id="preview-ttl"
              inputMode="numeric"
              placeholder="72"
              value={ttlHours}
              onChange={(event) => setTtlHours(event.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '创建中...' : '创建预览环境'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EnvironmentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`);
      if (!res.ok) {
        return;
      }

      const data: Environment[] = await res.json();
      setEnvironments(data);
      setExpanded((prev) => {
        if (Object.keys(prev).length > 0) {
          return prev;
        }

        return data[0] ? { [data[0].id]: true } : {};
      });
    } catch (error) {
      console.error('Failed to fetch environments:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const standardEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => !environment.isPreview)
        .sort((left, right) => left.order - right.order),
    [environments]
  );
  const previewEnvironments = useMemo(
    () =>
      [...environments]
        .filter((environment) => environment.isPreview)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [environments]
  );

  const toggleExpanded = (envId: string) => {
    setExpanded((prev) => ({ ...prev, [envId]: !prev[envId] }));
  };

  const handleCreatePreview = async (input: {
    branch: string;
    prNumber: string;
    ttlHours: string;
  }) => {
    setDialogLoading(true);
    setDialogError(null);

    const branch = input.branch.trim();
    const prNumber = input.prNumber.trim();
    const ttlHours = input.ttlHours.trim();

    if (!branch && !prNumber) {
      setDialogError('至少填写分支或 PR 号。');
      setDialogLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/preview-environments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branch || undefined,
          prNumber: prNumber ? Number.parseInt(prNumber, 10) : undefined,
          ttlHours: ttlHours ? Number.parseInt(ttlHours, 10) : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setDialogError(data.error || '创建预览环境失败');
        return;
      }

      setDialogOpen(false);
      setFeedback(`已准备 ${data.name}`);
      setExpanded((prev) => ({ ...prev, [data.id]: true }));
      await fetchEnvironments();
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeletePreview = async (environmentId: string) => {
    setDeletingId(environmentId);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/preview-environments/${environmentId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (!response.ok) {
        setFeedback(data.error || '删除预览环境失败');
        setTimeout(() => setFeedback(null), 5000);
        return;
      }

      setFeedback('预览环境已删除');
      await fetchEnvironments();
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-20 animate-pulse rounded-[20px] bg-muted" />
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[20px] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="环境"
        description="固定环境与预览环境共用同一套发布主链。"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            新建预览环境
          </Button>
        }
      />

      <PreviewEnvironmentDialog
        open={dialogOpen}
        loading={dialogLoading}
        error={dialogError}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDialogError(null);
          }
        }}
        onSubmit={handleCreatePreview}
      />

      {feedback && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      {environments.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="还没有环境"
          description="部署后会自动创建固定环境，也可以先创建预览环境。"
          action={{
            label: '新建预览环境',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4" />
              固定环境
            </div>
            {standardEnvironments.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-5 py-8 text-sm text-muted-foreground">
                还没有固定环境。
              </div>
            ) : (
              <div className="space-y-3">
                {standardEnvironments.map((environment) => {
                  const isExpanded = !!expanded[environment.id];
                  return (
                    <div key={environment.id} className="console-panel overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(environment.id)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/20"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              environment.namespace ? 'bg-success' : 'bg-warning'
                            )}
                          />
                          <span className="text-sm font-semibold capitalize">
                            {environment.name}
                          </span>
                          {environment.namespace ? (
                            <code className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono text-muted-foreground">
                              {environment.namespace}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">尚未部署</span>
                          )}
                          {environment.isProduction && <Badge>生产</Badge>}
                          {environment.autoDeploy && !environment.isProduction && (
                            <Badge variant="secondary">自动部署</Badge>
                          )}
                          {environment.policy.summary && (
                            <Badge variant="outline">{environment.policy.summary}</Badge>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/70 px-5 py-4">
                          <EnvVarManager
                            projectId={projectId}
                            environmentId={environment.id}
                            environmentName={environment.name}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4" />
              预览环境
            </div>

            {previewEnvironments.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-5 py-8 text-sm text-muted-foreground">
                还没有预览环境。创建后会自动接入 release 与 deployment 主链。
              </div>
            ) : (
              <div className="space-y-3">
                {previewEnvironments.map((environment) => {
                  const isExpanded = !!expanded[environment.id];
                  const previewScope = getEnvironmentScopeLabel(environment);
                  const previewSource = getEnvironmentSourceLabel(environment);
                  const expiryLabel = formatEnvironmentExpiry(environment.expiresAt);
                  const expiryTime = formatEnvironmentTimestamp(environment.expiresAt);
                  const primaryDomain = pickPrimaryEnvironmentDomain(environment.domains);

                  return (
                    <div key={environment.id} className="console-panel overflow-hidden">
                      <div className="flex items-start justify-between gap-3 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(environment.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-colors hover:text-foreground"
                        >
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-info" />
                              <span className="text-sm font-semibold">{environment.name}</span>
                              {previewScope && <Badge variant="secondary">{previewScope}</Badge>}
                              {previewSource && <Badge variant="outline">{previewSource}</Badge>}
                              {environment.policy.summary && (
                                <Badge variant="outline">{environment.policy.summary}</Badge>
                              )}
                              {expiryLabel && (
                                <Badge variant={expiryLabel === '已过期' ? 'warning' : 'outline'}>
                                  {expiryLabel}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              {environment.namespace ? (
                                <code className="rounded-xl bg-secondary px-2.5 py-1 font-mono">
                                  {environment.namespace}
                                </code>
                              ) : (
                                <span>尚未分配命名空间</span>
                              )}
                              {primaryDomain && (
                                <a
                                  href={buildEnvironmentAccessUrl(primaryDomain.hostname)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  <span>{primaryDomain.hostname}</span>
                                </a>
                              )}
                              {expiryTime && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  <span>{expiryTime}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0"
                              disabled={deletingId === environment.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>删除预览环境？</AlertDialogTitle>
                              <AlertDialogDescription>
                                这会删除 {environment.name} 及其关联资源。若还有活跃 release，
                                平台会拒绝删除。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePreview(environment.id)}
                                disabled={deletingId === environment.id}
                              >
                                {deletingId === environment.id ? '删除中...' : '确认删除'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/70 px-5 py-4">
                          <div className="mb-4 rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                              <div>
                                预览环境和正式环境走同一套 release、migration、deployment
                                主链，只是会自动过期回收。
                              </div>
                            </div>
                          </div>
                          {environment.domains.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                              {environment.domains.map((domain) => (
                                <a
                                  key={domain.id}
                                  href={buildEnvironmentAccessUrl(domain.hostname)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  <span>{domain.hostname}</span>
                                  {domain.service?.name && (
                                    <Badge variant="secondary">{domain.service.name}</Badge>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}
                          <EnvVarManager
                            projectId={projectId}
                            environmentId={environment.id}
                            environmentName={environment.name}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
