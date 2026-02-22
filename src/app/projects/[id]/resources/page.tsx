'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      state?: Record<string, { startedAt: string }>;
    }>;
  };
}

interface Service {
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    type: string;
    ports?: Array<{ port: number; targetPort: number | string; protocol: string }>;
  };
}

interface Deployment {
  metadata: {
    name: string;
    namespace: string;
  };
  status: {
    replicas: number;
    readyReplicas: number;
    updatedReplicas: number;
  };
}

export default function ProjectResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [resourceType, setResourceType] = useState<'pods' | 'services' | 'deployments'>('pods');
  const [environmentId, setEnvironmentId] = useState('');
  const [environments, setEnvironments] = useState<
    Array<{ id: string; name: string; namespace: string }>
  >([]);
  const [resources, setResources] = useState<Pod[] | Service[] | Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState('');
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}/environments`)
      .then((res) => res.json())
      .then((data) => {
        setEnvironments(data.environments || []);
        if (data.environments?.[0]) {
          setEnvironmentId(data.environments[0].id);
        }
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !environmentId) return;

    setLoading(true);
    fetch(`/api/projects/${projectId}/resources?type=${resourceType}&env=${environmentId}`)
      .then((res) => res.json())
      .then((data) => {
        setResources(data);
      })
      .finally(() => setLoading(false));
  }, [projectId, environmentId, resourceType]);

  useEffect(() => {
    if (!projectId || !environmentId || !selectedPod) return;

    setLoadingLogs(true);
    fetch(
      `/api/projects/${projectId}/resources/logs?pod=${selectedPod}&env=${environmentId}&tail=100`
    )
      .then((res) => res.text())
      .then((data) => {
        setLogs(data);
      })
      .finally(() => setLoadingLogs(false));
  }, [projectId, environmentId, selectedPod]);

  const getPodPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Running':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold">
              Juanie
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/projects/${projectId}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Project
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg">Resources</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex gap-4">
          <Select value={environmentId} onValueChange={setEnvironmentId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select environment" />
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
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Resource type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pods">Pods</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="deployments">Deployments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {resourceType === 'pods' && resources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>View Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPod} onValueChange={setSelectedPod}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a pod" />
                </SelectTrigger>
                <SelectContent>
                  {(resources as Pod[]).map((pod) => (
                    <SelectItem key={pod.metadata.name} value={pod.metadata.name}>
                      {pod.metadata.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedPod && (
          <Card>
            <CardHeader>
              <CardTitle>Logs: {selectedPod}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[400px] overflow-y-auto">
                {loadingLogs ? 'Loading...' : logs || 'No logs available'}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="capitalize">{resourceType}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : resourceType === 'pods' ? (
              <div className="space-y-2">
                {(resources as Pod[]).map((pod) => (
                  <div
                    key={pod.metadata.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{pod.metadata.name}</span>
                      <Badge className={getPodPhaseColor(pod.status.phase)}>
                        {pod.status.phase}
                      </Badge>
                      {pod.status.containerStatuses?.map((cs) => (
                        <span
                          key={cs.name}
                          className={`w-2 h-2 rounded-full ${cs.ready ? 'bg-green-500' : 'bg-red-500'}`}
                          title={`Container: ${cs.name}, Ready: ${cs.ready}`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPod(pod.metadata.name)}
                    >
                      View Logs
                    </Button>
                  </div>
                ))}
                {resources.length === 0 && <p className="text-muted-foreground">No pods found</p>}
              </div>
            ) : resourceType === 'services' ? (
              <div className="space-y-2">
                {(resources as Service[]).map((svc) => (
                  <div
                    key={svc.metadata.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-mono text-sm">{svc.metadata.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{svc.spec.type}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {svc.spec.ports?.map((p) => `${p.port}:${p.targetPort}`).join(', ')}
                    </div>
                  </div>
                ))}
                {resources.length === 0 && (
                  <p className="text-muted-foreground">No services found</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(resources as Deployment[]).map((deploy) => (
                  <div
                    key={deploy.metadata.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-mono text-sm">{deploy.metadata.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {deploy.status.readyReplicas}/{deploy.status.replicas} ready
                    </span>
                  </div>
                ))}
                {resources.length === 0 && (
                  <p className="text-muted-foreground">No deployments found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
