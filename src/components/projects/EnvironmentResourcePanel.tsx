'use client';

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

interface EnvironmentResourcePanelProps {
  projectId: string;
  environmentId: string;
  environmentName: string;
}

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

export function EnvironmentResourcePanel({
  projectId,
  environmentId,
  environmentName,
}: EnvironmentResourcePanelProps) {
  const [resourceType, setResourceType] = useState<'pods' | 'services' | 'deployments'>('pods');
  const [resources, setResources] = useState<Pod[] | Service[] | K8sDeployment[]>([]);
  const [resourceError, setResourceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState('');
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const resourceTypeLabel: Record<'pods' | 'services' | 'deployments', string> = {
    pods: 'Pod',
    services: 'Service',
    deployments: 'Deployment',
  };

  useEffect(() => {
    if (!projectId || !environmentId) return;
    setLoading(true);
    setResourceError('');
    setSelectedPod('');
    fetch(`/api/projects/${projectId}/resources?type=${resourceType}&env=${environmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setResourceError(data.error);
          setResources([]);
        } else {
          setResources(Array.isArray(data) ? data : []);
        }
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

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">资源诊断</div>
          <div className="mt-1 text-xs text-muted-foreground">
            查看 {environmentName} 的 Pod、Service 和 Deployment 原始状态，仅用于排障。
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href={`/projects/${projectId}/logs?env=${environmentId}`}>查看环境日志</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={resourceType}
          onValueChange={(value) => setResourceType(value as 'pods' | 'services' | 'deployments')}
        >
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue placeholder="资源类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pods">Pod</SelectItem>
            <SelectItem value="services">Service</SelectItem>
            <SelectItem value="deployments">Deployment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
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
                    {service.spec.ports
                      ?.map((port) => `${port.port}→${port.targetPort}`)
                      .join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>

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
                <Link href={`/projects/${projectId}/logs?env=${environmentId}`}>环境日志</Link>
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
