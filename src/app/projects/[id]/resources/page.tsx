'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusIndicator } from '@/components/ui/status-indicator';

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

export default function ProjectResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [resourceType, setResourceType] = useState<'pods' | 'services' | 'deployments'>('pods');
  const [environmentId, setEnvironmentId] = useState('');
  const [environments, setEnvironments] = useState<
    Array<{ id: string; name: string; namespace: string }>
  >([]);
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
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/environments`)
      .then((res) => res.json())
      .then((data) => {
        const envList = Array.isArray(data) ? data : (data.environments ?? []);
        setEnvironments(envList);
        if (envList[0]) setEnvironmentId(envList[0].id);
      });
  }, [projectId]);

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
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="资源" description="项目内 Kubernetes 资源" />

      <div className="console-panel flex flex-wrap gap-3 px-4 py-4">
        <Select value={environmentId} onValueChange={setEnvironmentId}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="环境" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                {env.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={resourceType}
          onValueChange={(v) => setResourceType(v as 'pods' | 'services' | 'deployments')}
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

      <section className="console-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold">{resourceTypeLabel[resourceType]}</div>
        </div>
        <div className="p-3">
          {resourceError ? (
            <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
              {resourceError}
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
              没有可用的 {resourceType}
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
                    日志
                  </Button>
                </div>
              ))}
            </div>
          ) : resourceType === 'services' ? (
            <div className="space-y-2">
              {(resources as Service[]).map((svc) => (
                <div
                  key={svc.metadata.name}
                  className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
                >
                  <span className="font-mono text-sm">{svc.metadata.name}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{svc.spec.type}</span>
                    <span>
                      {svc.spec.ports?.map((p) => `${p.port}→${p.targetPort}`).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(resources as K8sDeployment[]).map((deploy) => (
                <div
                  key={deploy.metadata.name}
                  className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
                >
                  <span className="font-mono text-sm">{deploy.metadata.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusIndicator
                      status={
                        deploy.status.readyReplicas > 0 &&
                        deploy.status.readyReplicas === deploy.status.replicas
                          ? 'success'
                          : 'warning'
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {deploy.status.readyReplicas ?? 0}/{deploy.status.replicas ?? 0} 就绪
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedPod && (
        <section className="console-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">日志 · {selectedPod}</div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => setSelectedPod('')}
            >
              关闭
            </Button>
          </div>
          <div className="p-3">
            <pre className="max-h-[480px] overflow-x-auto overflow-y-auto rounded-2xl bg-zinc-950 p-4 font-mono text-xs whitespace-pre-wrap text-zinc-100">
              {loadingLogs ? '加载中...' : logs || '暂无日志'}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
