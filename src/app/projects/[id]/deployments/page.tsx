'use client';

import {
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  GitCommit,
  Rocket,
  RotateCcw,
} from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useDeployments } from '@/hooks/useDeployments';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean; label?: string }
> = {
  queued: { color: 'neutral', pulse: false },
  building: { color: 'info', pulse: true },
  deploying: { color: 'info', pulse: true },
  running: { color: 'success', pulse: false, label: 'Active' },
  running_old: { color: 'neutral', pulse: false, label: 'Deployed' },
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
  imageUrl?: string | null;
  createdAt: string;
}

interface Environment {
  id: string;
  name: string;
  autoDeploy: boolean;
  isProduction: boolean;
}

interface LogEntry {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

function DeploymentLogs({
  projectId,
  deploymentId,
  status,
}: {
  projectId: string;
  deploymentId: string;
  status: string;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLive = status === 'building' || status === 'deploying' || status === 'queued';

  useEffect(() => {
    if (!isLive) {
      fetch(`/api/projects/${projectId}/deployments/${deploymentId}/logs`)
        .then((r) => r.json())
        .then((data) => {
          setLogs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    const es = new EventSource(
      `/api/projects/${projectId}/deployments/${deploymentId}/logs/stream`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'logs') {
        setLogs(data.logs);
        setLoading(false);
      } else if (data.type === 'complete') {
        es.close();
      } else if (data.type === 'error') {
        es.close();
        setLoading(false);
      }
    };

    es.onerror = () => {
      es.close();
      setLoading(false);
    };

    setLoading(false);
    return () => es.close();
  }, [projectId, deploymentId, isLive]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bottomRef is a stable ref
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs max-h-56 overflow-y-auto border border-zinc-800">
      {loading ? (
        <span className="text-zinc-500">Loading logs…</span>
      ) : logs.length === 0 ? (
        <span className="text-zinc-500">No logs yet</span>
      ) : (
        logs.map((entry) => (
          <div key={entry.id} className="flex gap-2 mb-0.5">
            <span className="text-zinc-600 shrink-0">
              {new Date(entry.createdAt).toLocaleTimeString()}
            </span>
            <span
              className={cn(
                entry.level === 'error'
                  ? 'text-red-400'
                  : entry.level === 'warn'
                    ? 'text-yellow-400'
                    : 'text-zinc-300'
              )}
            >
              {entry.message}
            </span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default function DeploymentsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const envFilter = searchParams.get('env');
  const [filter, setFilter] = useState<string>(envFilter || 'all');
  const [history, setHistory] = useState<DeploymentRecord[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackResult, setRollbackResult] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/environments`)
      .then((r) => r.json())
      .then((data) => setEnvironments(Array.isArray(data) ? data : []));
  }, [projectId]);

  const { isConnected, error } = useDeployments({
    projectId,
    onDeployment: () => loadHistory(),
  });

  const handlePromote = async () => {
    if (promoting) return;
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/promote`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPromoteResult(data.tagName ? `Promoted → ${data.tagName}` : 'Promoted to production');
        await loadHistory();
      } else {
        setPromoteResult(`Error: ${data.error}`);
      }
    } finally {
      setPromoting(false);
      setTimeout(() => setPromoteResult(null), 5000);
    }
  };

  const handleRollback = async (depId: string) => {
    if (rollingBack) return;
    setRollingBack(depId);
    setRollbackResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/deployments/${depId}/rollback`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setRollbackResult('Rolled back successfully');
        await loadHistory();
      } else {
        setRollbackResult(`Error: ${data.error}`);
      }
    } finally {
      setRollingBack(null);
      setTimeout(() => setRollbackResult(null), 5000);
    }
  };

  const toggleLogs = (depId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(depId)) {
        next.delete(depId);
      } else {
        next.add(depId);
      }
      return next;
    });
  };

  const hasStagingProdSplit = environments.some((e) => e.isProduction);
  const latestRunningId = new Map<string, string>();
  for (const d of history) {
    if (d.status === 'running' && !latestRunningId.has(d.environmentName)) {
      latestRunningId.set(d.environmentName, d.id);
    }
  }

  const envNames = ['all', ...new Set(history.map((d) => d.environmentName))];
  const filtered = filter === 'all' ? history : history.filter((d) => d.environmentName === filter);

  // Find latest successful staging deployment to determine if promote is possible
  const stagingEnv = environments.find((e) => e.autoDeploy && !e.isProduction);
  const latestStagingRunning = stagingEnv
    ? history.find((d) => d.environmentName === stagingEnv.name && d.status === 'running')
    : null;
  const canPromote = hasStagingProdSplit && !!latestStagingRunning?.imageUrl;

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
            {hasStagingProdSplit && (
              <Button
                size="sm"
                className="h-8"
                onClick={handlePromote}
                disabled={promoting || !canPromote}
              >
                <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
                {promoting ? 'Promoting...' : 'Promote to Production'}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-3 text-sm bg-warning/10 text-warning-foreground rounded-lg border border-warning/20">
          {error}
        </div>
      )}

      {promoteResult && (
        <div
          className={`p-3 text-sm rounded-lg border ${
            promoteResult.startsWith('Error')
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'bg-success/10 text-success-foreground border-success/20'
          }`}
        >
          {promoteResult}
        </div>
      )}

      {rollbackResult && (
        <div
          className={`p-3 text-sm rounded-lg border ${
            rollbackResult.startsWith('Error')
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'bg-success/10 text-success-foreground border-success/20'
          }`}
        >
          {rollbackResult}
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
            const isOldRunning =
              deployment.status === 'running' &&
              latestRunningId.get(deployment.environmentName) !== deployment.id;
            const configKey = isOldRunning ? 'running_old' : deployment.status;
            const config = statusConfig[configKey] || statusConfig.queued;
            const isActive = configKey === 'running';
            const canRollback = !!deployment.imageUrl && !isActive;
            const logsExpanded = expandedLogs.has(deployment.id);

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
                                : 'bg-muted-foreground/30'
                      }`}
                    />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusIndicator
                              status={config.color}
                              pulse={config.pulse}
                              label={config.label ?? deployment.status}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {deployment.version ? `v${deployment.version}` : '—'}
                              </span>
                              <Badge
                                variant={
                                  environments.find(
                                    (e) => e.name === deployment.environmentName && e.isProduction
                                  )
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="capitalize"
                              >
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
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {deployment.createdAt
                                ? new Date(deployment.createdAt).toLocaleString()
                                : 'Pending'}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => toggleLogs(deployment.id)}
                            title={logsExpanded ? 'Hide logs' : 'Show logs'}
                          >
                            {logsExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {canRollback && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleRollback(deployment.id)}
                              disabled={rollingBack === deployment.id}
                              title="Roll back to this version"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {rollingBack === deployment.id ? 'Rolling back…' : 'Roll back'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {logsExpanded && (
                        <div className="mt-3">
                          <DeploymentLogs
                            projectId={projectId}
                            deploymentId={deployment.id}
                            status={deployment.status}
                          />
                        </div>
                      )}
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
