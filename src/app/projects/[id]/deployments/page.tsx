'use client';

import { Clock, Filter, GitCommit, Rocket } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useDeployments } from '@/hooks/useDeployments';

const statusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean }
> = {
  queued: { color: 'neutral', pulse: false },
  building: { color: 'info', pulse: true },
  deploying: { color: 'info', pulse: true },
  running: { color: 'success', pulse: false },
  failed: { color: 'error', pulse: false },
  rolled_back: { color: 'warning', pulse: false },
};

interface DeploymentRecord {
  id: string;
  status: string;
  version: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  environmentName: string;
  environmentId?: string;
  createdAt: string;
}

interface Environment {
  id: string;
  name: string;
}

export default function DeploymentsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const envFilter = searchParams.get('env');
  const [filter, setFilter] = useState<string>(envFilter || 'all');
  const [history, setHistory] = useState<DeploymentRecord[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState('');

  // Load initial history from REST
  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/deployments`);
    if (!res.ok) return;
    const data = await res.json();
    const mapped: DeploymentRecord[] = data.map(
      (row: { deployment: DeploymentRecord; environmentName: string }) => ({
        ...row.deployment,
        environmentName: row.environmentName,
      })
    );
    setHistory(mapped);
  }, [projectId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load environments for redeploy
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/environments`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setEnvironments(list);
        if (list[0]) setSelectedEnvId(list[0].id);
      });
  }, [projectId]);

  // SSE for live updates
  const { isConnected, error } = useDeployments({
    projectId,
    onDeployment: () => {
      // Refresh history when a new deployment event arrives
      loadHistory();
    },
  });

  const handleRedeploy = async () => {
    if (!selectedEnvId || deploying) return;
    setDeploying(true);
    try {
      await fetch(`/api/projects/${projectId}/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentId: selectedEnvId }),
      });
      await loadHistory();
    } finally {
      setDeploying(false);
    }
  };

  const envNames = ['all', ...new Set(history.map((d) => d.environmentName))];
  const filtered = filter === 'all' ? history : history.filter((d) => d.environmentName === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        description="Real-time deployment status and history"
        actions={
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={isConnected ? 'success' : 'neutral'}
              label={isConnected ? 'Live' : 'Offline'}
              pulse={isConnected}
            />
            {environments.length > 0 && (
              <Button size="sm" className="h-8" onClick={handleRedeploy} disabled={deploying}>
                <Rocket className="h-3.5 w-3.5 mr-1.5" />
                {deploying ? 'Deploying...' : 'Redeploy'}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 text-sm bg-warning/10 text-warning-foreground rounded-lg border border-warning/20">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {envNames.map((env) => (
          <Button
            key={env}
            variant={filter === env ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(env)}
            className="capitalize"
          >
            {env}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Rocket className="h-12 w-12" />}
          title="No deployments yet"
          description="Push to your repository to trigger a deployment"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((deployment) => {
            const config = statusConfig[deployment.status] || statusConfig.queued;
            return (
              <Card key={deployment.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center">
                    <div
                      className={`w-1 self-stretch ${
                        config.color === 'success'
                          ? 'bg-success'
                          : config.color === 'error'
                            ? 'bg-destructive'
                            : config.color === 'warning'
                              ? 'bg-warning'
                              : config.color === 'info'
                                ? 'bg-info'
                                : 'bg-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusIndicator
                              status={config.color}
                              pulse={config.pulse}
                              label={deployment.status}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {deployment.version ? `v${deployment.version}` : '—'}
                              </span>
                              <Badge variant="secondary" className="capitalize">
                                {deployment.environmentName}
                              </Badge>
                            </div>
                            {(deployment.commitSha || deployment.commitMessage) && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                {deployment.commitSha && (
                                  <>
                                    <GitCommit className="h-3.5 w-3.5" />
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {deployment.commitSha.slice(0, 7)}
                                    </code>
                                  </>
                                )}
                                {deployment.commitMessage && (
                                  <span className="text-xs truncate max-w-[320px]">
                                    {deployment.commitMessage}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {deployment.createdAt
                              ? new Date(deployment.createdAt).toLocaleString()
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
