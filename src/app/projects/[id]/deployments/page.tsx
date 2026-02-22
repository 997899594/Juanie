'use client';

import { Clock, Filter, GitCommit, Rocket } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
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
  pending: { color: 'neutral', pulse: false },
  deploying: { color: 'info', pulse: true },
  syncing: { color: 'info', pulse: true },
  deployed: { color: 'success', pulse: false },
  failed: { color: 'error', pulse: false },
  rolled_back: { color: 'warning', pulse: false },
};

export default function DeploymentsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const envFilter = searchParams.get('env');
  const [filter, setFilter] = useState<string>(envFilter || 'all');

  const { deployments, isConnected, error } = useDeployments({
    projectId,
  });

  const environments = ['all', ...new Set(deployments.map((d) => d.environmentName))];

  const filteredDeployments =
    filter === 'all' ? deployments : deployments.filter((d) => d.environmentName === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        description="Real-time deployment status and history"
        actions={
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={isConnected ? 'success' : 'error'}
              label={isConnected ? 'Live' : 'Offline'}
              pulse={isConnected}
            />
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
        {environments.map((env) => (
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

      {filteredDeployments.length === 0 ? (
        <EmptyState
          icon={<Rocket className="h-12 w-12" />}
          title="No deployments yet"
          description="Push to your repository to trigger a deployment"
        />
      ) : (
        <div className="space-y-3">
          {filteredDeployments.map((deployment) => {
            const config = statusConfig[deployment.status] || statusConfig.pending;
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <StatusIndicator
                              status={config.color}
                              pulse={config.pulse}
                              label={deployment.status}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">v{deployment.version}</span>
                              <Badge variant="secondary" className="capitalize">
                                {deployment.environmentName}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {deployment.commitSha && (
                            <div className="flex items-center gap-1">
                              <GitCommit className="h-4 w-4" />
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                {deployment.commitSha.slice(0, 7)}
                              </code>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {deployment.createdAt
                                ? new Date(deployment.createdAt).toLocaleString()
                                : 'Pending'}
                            </span>
                          </div>
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
