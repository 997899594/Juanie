'use client';

import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EnvVarManager } from '@/components/projects/EnvVarManager';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  order: number;
  namespace: string | null;
}

export default function EnvironmentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  // 展开状态：key = environmentId
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`);
      if (res.ok) {
        const data: Environment[] = await res.json();
        setEnvironments(data);
        // 默认展开第一个环境
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
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage environment variables and secrets for each deployment environment.
        </p>
      </div>

      {environments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-2">No environments</h2>
          <p className="text-sm text-muted-foreground">
            Environments will be created when you deploy
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {environments.map((env) => {
            const isExpanded = !!expanded[env.id];
            return (
              <div key={env.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Environment header（可点击折叠/展开） */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(env.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        env.namespace ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                    <span className="font-medium capitalize">{env.name}</span>
                    {env.namespace && (
                      <code className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {env.namespace}
                      </code>
                    )}
                    {!env.namespace && (
                      <span className="text-xs text-muted-foreground">Not yet deployed</span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* 展开的变量管理区域 */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t">
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
