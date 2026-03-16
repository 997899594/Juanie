'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          setLogs(`[Error] ${err.error ?? 'Failed to fetch logs'}`);
        } else {
          setLogs(await res.text());
        }
      })
      .finally(() => setLoadingLogs(false));
  }, [projectId, environmentId, selectedPod]);

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" description="Kubernetes workloads running in this project" />

      <div className="flex gap-3">
        <Select value={environmentId} onValueChange={setEnvironmentId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Environment" />
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Resource type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pods">Pods</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="deployments">Deployments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium capitalize">{resourceType}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {resourceError ? (
            <p className="text-sm text-destructive p-4">{resourceError}</p>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No {resourceType} found</p>
          ) : resourceType === 'pods' ? (
            <div className="divide-y">
              {(resources as Pod[]).map((pod) => (
                <div
                  key={pod.metadata.name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <StatusIndicator status={podPhaseStatus(pod.status.phase)} />
                    <span className="font-mono text-sm">{pod.metadata.name}</span>
                    <span className="text-xs text-muted-foreground">{pod.status.phase}</span>
                    {pod.status.containerStatuses?.some((cs) => cs.restartCount > 0) && (
                      <span className="text-xs text-warning">
                        {pod.status.containerStatuses.reduce((sum, cs) => sum + cs.restartCount, 0)}{' '}
                        restart
                        {pod.status.containerStatuses.reduce(
                          (sum, cs) => sum + cs.restartCount,
                          0
                        ) !== 1
                          ? 's'
                          : ''}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedPod(pod.metadata.name)}
                  >
                    Logs
                  </Button>
                </div>
              ))}
            </div>
          ) : resourceType === 'services' ? (
            <div className="divide-y">
              {(resources as Service[]).map((svc) => (
                <div
                  key={svc.metadata.name}
                  className="flex items-center justify-between px-4 py-3"
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
            <div className="divide-y">
              {(resources as K8sDeployment[]).map((deploy) => (
                <div
                  key={deploy.metadata.name}
                  className="flex items-center justify-between px-4 py-3"
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
                      {deploy.status.readyReplicas ?? 0}/{deploy.status.replicas ?? 0} ready
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPod && (
        <Card>
          <CardHeader className="py-3 px-4 border-b flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Logs: {selectedPod}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedPod('')}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-b-lg overflow-x-auto text-xs font-mono max-h-[480px] overflow-y-auto whitespace-pre-wrap">
              {loadingLogs ? 'Loading...' : logs || 'No logs available'}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
