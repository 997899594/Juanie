'use client';

import { Globe } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`);
      if (res.ok) {
        const data = await res.json();
        setEnvironments(data);
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {environments.length} environment{environments.length !== 1 ? 's' : ''}
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
        <div className="grid grid-cols-3 gap-4">
          {environments.map((env) => (
            <div key={env.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium capitalize">{env.name}</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      env.namespace ? 'bg-success' : 'bg-warning'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {env.namespace ? 'Active' : 'Pending'}
                  </span>
                </div>
              </div>
              {env.namespace ? (
                <code className="text-xs bg-muted px-2 py-1 rounded block">{env.namespace}</code>
              ) : (
                <p className="text-xs text-muted-foreground">Not yet deployed</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
