'use client';

import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  order: number;
  namespace: string | null;
  isProduction: boolean;
  autoDeploy: boolean;
}

export default function EnvironmentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`);
      if (res.ok) {
        const data: Environment[] = await res.json();
        setEnvironments(data);
        if (data.length > 0) {
          setExpanded({ [data[0].id]: true });
        }
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const toggleExpanded = (envId: string) => {
    setExpanded((prev) => ({ ...prev, [envId]: !prev[envId] }));
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
      <PageHeader title="环境" description="环境变量与部署目标" />

      {environments.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有环境</h2>
          <p className="mt-2 text-sm text-muted-foreground">部署后会自动创建环境。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {environments.map((env) => {
            const isExpanded = !!expanded[env.id];
            return (
              <div key={env.id} className="console-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpanded(env.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/20"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        env.namespace ? 'bg-success' : 'bg-warning'
                      )}
                    />
                    <span className="text-sm font-semibold capitalize">{env.name}</span>
                    {env.namespace ? (
                      <code className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono text-muted-foreground">
                        {env.namespace}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">尚未部署</span>
                    )}
                    {env.isProduction && <Badge>生产</Badge>}
                    {env.autoDeploy && !env.isProduction && (
                      <Badge variant="secondary">自动部署</Badge>
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
                      environmentId={env.id}
                      environmentName={env.name}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
