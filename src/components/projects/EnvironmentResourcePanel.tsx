'use client';

import { AlertTriangle, Boxes, Clock3, Database, ServerCrash } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';

interface Pod {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  status: {
    phase: string;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
    }>;
  };
}

interface Service {
  metadata: { name: string; namespace: string };
  spec: {
    type: string;
    ports?: Array<{ port: number; targetPort: number | string; protocol: string }>;
  };
}

interface K8sDeployment {
  metadata: { name: string; namespace: string };
  status: { replicas: number; readyReplicas: number; updatedReplicas: number };
}

interface K8sEvent {
  metadata?: { uid?: string };
  reason?: string;
  message?: string;
  type?: string;
  involvedObject?: { name?: string; kind?: string };
  lastTimestamp?: string;
  firstTimestamp?: string;
}

interface DiagnosticsBucket {
  count: number;
  names: string[];
  label: string;
}

interface EnvironmentDiagnostics {
  available: boolean;
  summary: string | null;
  nextActionLabel: string | null;
  primaryIssue: {
    code: string;
    label: string;
    summary: string;
    nextActionLabel: string;
  } | null;
  recommendations: Array<{
    key: string;
    label: string;
    summary: string;
  }>;
  capacity: {
    nodeCount: number;
    saturationLabel: string | null;
    allocatableMemoryLabel: string;
    requestedMemoryLabel: string;
    availableMemoryLabel: string;
    platformRequestedMemoryLabel: string;
    environmentRequestedMemoryLabel: string;
    estimatedRolloutDeltaMemoryLabel: string;
  };
  abnormalResources: {
    namespacePendingPods: DiagnosticsBucket;
    namespaceCrashLoopPods: DiagnosticsBucket;
    namespaceImagePullPods: DiagnosticsBucket;
    namespaceOOMKilledPods: DiagnosticsBucket;
    clusterTerminatingPods: DiagnosticsBucket;
    clusterLongPendingPods: DiagnosticsBucket;
  };
  incidents: Array<{
    key: string;
    at: string | null;
    title: string;
    description: string;
    tone: 'info' | 'warning' | 'danger';
  }>;
}

interface EnvironmentResourcePanelProps {
  projectId: string;
  environmentId: string;
  environmentName: string;
  canManage?: boolean;
  manageSummary?: string | null;
}

type ResourceType = 'diagnostics' | 'pods' | 'services' | 'deployments' | 'events';

function podPhaseStatus(phase: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (phase) {
    case 'Running':
      return 'success';
    case 'Pending':
      return 'warning';
    case 'Failed':
      return 'error';
    default:
      return 'neutral';
  }
}

function formatPodPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    Running: '运行中',
    Pending: '等待中',
    Failed: '失败',
    Succeeded: '已完成',
    Unknown: '未知',
  };

  return labels[phase] ?? phase;
}

function formatIncidentTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function toneClassName(tone: 'info' | 'warning' | 'danger'): string {
  switch (tone) {
    case 'danger':
      return 'text-destructive';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-info';
  }
}

function DiagnosticsOverview({ diagnostics }: { diagnostics: EnvironmentDiagnostics | null }) {
  if (!diagnostics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {(diagnostics.summary || diagnostics.nextActionLabel) && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-background p-2 text-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {diagnostics.primaryIssue?.label ?? '基础设施状态稳定'}
              </div>
              {diagnostics.summary && (
                <div className="mt-2 text-sm text-muted-foreground">{diagnostics.summary}</div>
              )}
              {diagnostics.nextActionLabel && (
                <div className="mt-2 text-xs text-muted-foreground">
                  下一步：{diagnostics.nextActionLabel}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {diagnostics.recommendations.length > 0 && (
        <div className="rounded-2xl border border-border bg-background px-4 py-4">
          <div className="text-sm font-medium">治理建议</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {diagnostics.recommendations.map((recommendation) => (
              <div
                key={recommendation.key}
                className="rounded-2xl border border-border bg-secondary/20 px-4 py-3"
              >
                <div className="text-sm font-medium">{recommendation.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{recommendation.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <ServerCrash className="h-3.5 w-3.5" />
            集群容量
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {diagnostics.capacity.availableMemoryLabel}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            已请求 {diagnostics.capacity.requestedMemoryLabel} / 可分配{' '}
            {diagnostics.capacity.allocatableMemoryLabel}
            {diagnostics.capacity.saturationLabel
              ? ` · 使用率 ${diagnostics.capacity.saturationLabel}`
              : ''}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            平台占用
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {diagnostics.capacity.platformRequestedMemoryLabel}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            环境当前请求 {diagnostics.capacity.environmentRequestedMemoryLabel}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            放量增量
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {diagnostics.capacity.estimatedRolloutDeltaMemoryLabel}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">按当前发布策略估算新增内存请求</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            异常残留
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {diagnostics.abnormalResources.clusterTerminatingPods.count}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">卡住的 Terminating Pod</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-border bg-background px-4 py-4">
          <div className="text-sm font-medium">异常资源</div>
          <div className="mt-3 space-y-3">
            {[
              diagnostics.abnormalResources.namespacePendingPods,
              diagnostics.abnormalResources.namespaceCrashLoopPods,
              diagnostics.abnormalResources.namespaceImagePullPods,
              diagnostics.abnormalResources.namespaceOOMKilledPods,
              diagnostics.abnormalResources.clusterTerminatingPods,
              diagnostics.abnormalResources.clusterLongPendingPods,
            ].map((bucket) => (
              <div
                key={bucket.label}
                className="rounded-2xl border border-border bg-secondary/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{bucket.label}</div>
                  <div className="text-xs text-muted-foreground">{bucket.count}</div>
                </div>
                {bucket.names.length > 0 && (
                  <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {bucket.names.slice(0, 3).join('，')}
                    {bucket.names.length > 3 ? ` 等 ${bucket.names.length} 个` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background px-4 py-4">
          <div className="text-sm font-medium">基础设施事件线</div>
          <div className="mt-1 text-xs text-muted-foreground">
            只保留会影响发布结果的事件，不再直接把原始 Event 全量摊给你。
          </div>
          <div className="mt-4 space-y-3">
            {diagnostics.incidents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
                最近没有发现会影响发布的基础设施异常。
              </div>
            ) : (
              diagnostics.incidents.map((incident) => (
                <div
                  key={incident.key}
                  className="rounded-2xl border border-border bg-secondary/20 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn('text-sm font-medium', toneClassName(incident.tone))}>
                      {incident.title}
                    </div>
                    {incident.at && (
                      <div className="text-xs text-muted-foreground">
                        {formatIncidentTime(incident.at)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{incident.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EnvironmentResourcePanel({
  projectId,
  environmentId,
  environmentName,
  canManage = false,
  manageSummary,
}: EnvironmentResourcePanelProps) {
  const [resourceType, setResourceType] = useState<ResourceType>('diagnostics');
  const [resources, setResources] = useState<Pod[] | Service[] | K8sDeployment[] | K8sEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostics | null>(null);
  const [resourceError, setResourceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState('');
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [remediationAction, setRemediationAction] = useState<string | null>(null);
  const [remediationFeedback, setRemediationFeedback] = useState<string | null>(null);

  const resourceTypeLabel: Record<ResourceType, string> = {
    diagnostics: '诊断概览',
    pods: 'Pod',
    services: 'Service',
    deployments: 'Deployment',
    events: 'Event',
  };

  useEffect(() => {
    if (!projectId || !environmentId) return;
    setLoading(true);
    setResourceError('');
    setSelectedPod('');
    if (resourceType !== 'pods') {
      setLogs('');
    }

    fetch(`/api/projects/${projectId}/resources?type=${resourceType}&env=${environmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setResourceError(data.error);
          setResources([]);
          setDiagnostics(null);
          return;
        }

        if (resourceType === 'diagnostics') {
          setDiagnostics(data as EnvironmentDiagnostics);
          setResources([]);
          return;
        }

        setDiagnostics(null);
        setResources(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [projectId, environmentId, resourceType]);

  useEffect(() => {
    if (!projectId || !environmentId || !selectedPod) return;
    setLoadingLogs(true);
    fetch(
      `/api/projects/${projectId}/resources/logs?pod=${selectedPod}&env=${environmentId}&tail=200`
    )
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          setLogs(`[错误] ${err.error ?? '获取日志失败'}`);
        } else {
          setLogs(await res.text());
        }
      })
      .finally(() => setLoadingLogs(false));
  }, [projectId, environmentId, selectedPod]);

  const runRemediation = async (action: 'restart_deployments' | 'cleanup_terminating_pods') => {
    if (!projectId || !environmentId) return;
    setRemediationAction(action);
    setRemediationFeedback(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/resources/remediation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          environmentId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        summary?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? '治理动作执行失败');
      }

      setRemediationFeedback(payload?.summary ?? '治理动作已触发');
      if (resourceType === 'diagnostics') {
        setLoading(true);
        const refreshed = await fetch(
          `/api/projects/${projectId}/resources?type=diagnostics&env=${environmentId}`
        ).then((res) => res.json());
        setDiagnostics(refreshed as EnvironmentDiagnostics);
        setLoading(false);
      }
    } catch (error) {
      setRemediationFeedback(error instanceof Error ? error.message : '治理动作执行失败');
    } finally {
      setRemediationAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">容量与异常</div>
          <div className="mt-1 text-xs text-muted-foreground">
            先看 {environmentName} 已归因后的容量、阻塞和异常残留。只有需要更底层细节时， 再切到原始
            K8s 资源。
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href={`/projects/${projectId}/runtime/logs?env=${environmentId}`}>
            查看环境日志
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={resourceType}
          onValueChange={(value) => setResourceType(value as ResourceType)}
        >
          <SelectTrigger className="w-[220px] rounded-xl">
            <SelectValue placeholder="资源类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diagnostics">诊断概览</SelectItem>
            <SelectItem value="pods">Pod</SelectItem>
            <SelectItem value="deployments">部署</SelectItem>
            <SelectItem value="events">事件</SelectItem>
            <SelectItem value="services">服务</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {resourceType === 'diagnostics' && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={
              !canManage ||
              remediationAction !== null ||
              (diagnostics?.abnormalResources.clusterTerminatingPods.count ?? 0) === 0
            }
            title={canManage ? undefined : (manageSummary ?? undefined)}
            onClick={() => runRemediation('cleanup_terminating_pods')}
          >
            {remediationAction === 'cleanup_terminating_pods' ? '清理中...' : '清理残留 Pod'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!canManage || remediationAction !== null}
            title={canManage ? undefined : (manageSummary ?? undefined)}
            onClick={() => runRemediation('restart_deployments')}
          >
            {remediationAction === 'restart_deployments' ? '重启中...' : '重启环境部署'}
          </Button>
        </div>
      )}

      {remediationFeedback && (
        <div className="mb-4 rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          {remediationFeedback}
        </div>
      )}

      {resourceError ? (
        <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
          {resourceError}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : resourceType === 'diagnostics' ? (
        <DiagnosticsOverview diagnostics={diagnostics} />
      ) : resources.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
          没有可用的 {resourceTypeLabel[resourceType]}
        </div>
      ) : resourceType === 'pods' ? (
        <div className="space-y-2">
          {(resources as Pod[]).map((pod) => (
            <div
              key={pod.metadata.name}
              className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusIndicator status={podPhaseStatus(pod.status.phase)} />
                <span className="truncate font-mono text-sm">{pod.metadata.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatPodPhaseLabel(pod.status.phase)}
                </span>
                {pod.status.containerStatuses?.some((cs) => cs.restartCount > 0) && (
                  <span className="text-xs text-muted-foreground">
                    {pod.status.containerStatuses.reduce((sum, cs) => sum + cs.restartCount, 0)}{' '}
                    次重启
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedPod(pod.metadata.name)}
              >
                Pod 日志
              </Button>
            </div>
          ))}
        </div>
      ) : resourceType === 'services' ? (
        <div className="space-y-2">
          {(resources as Service[]).map((service) => (
            <div
              key={service.metadata.name}
              className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
            >
              <span className="font-mono text-sm">{service.metadata.name}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{service.spec.type}</span>
                <span>
                  {service.spec.ports?.map((port) => `${port.port}→${port.targetPort}`).join(', ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : resourceType === 'deployments' ? (
        <div className="space-y-2">
          {(resources as K8sDeployment[]).map((deployment) => (
            <div
              key={deployment.metadata.name}
              className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
            >
              <span className="font-mono text-sm">{deployment.metadata.name}</span>
              <div className="flex items-center gap-2">
                <StatusIndicator
                  status={
                    deployment.status.readyReplicas > 0 &&
                    deployment.status.readyReplicas === deployment.status.replicas
                      ? 'success'
                      : 'warning'
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {deployment.status.readyReplicas ?? 0}/{deployment.status.replicas ?? 0} 就绪
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(resources as K8sEvent[]).map((event, index) => (
            <div
              key={event.metadata?.uid ?? `${event.reason ?? 'event'}-${index}`}
              className="rounded-2xl bg-secondary/20 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{event.reason ?? 'Event'}</div>
                {event.involvedObject?.name && (
                  <div className="text-xs text-muted-foreground">
                    {event.involvedObject.kind ?? '资源'} · {event.involvedObject.name}
                  </div>
                )}
              </div>
              {event.message && (
                <div className="mt-1 text-sm text-muted-foreground">{event.message}</div>
              )}
              {(event.lastTimestamp || event.firstTimestamp) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatIncidentTime(event.lastTimestamp ?? event.firstTimestamp ?? null)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPod && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Pod 原始日志 · {selectedPod}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                单个 Pod 细节放在这里；整条链路日志请直接看环境日志。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href={`/projects/${projectId}/runtime/logs?env=${environmentId}`}>
                  环境日志
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedPod('')}
              >
                关闭
              </Button>
            </div>
          </div>
          <div className="p-3">
            <pre
              className={cn(
                'max-h-[360px] overflow-x-auto overflow-y-auto rounded-2xl bg-zinc-950 p-4 font-mono text-xs whitespace-pre-wrap text-zinc-100'
              )}
            >
              {loadingLogs ? '加载中...' : logs || '暂无日志'}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
