'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

interface DeploymentLogsProps {
  projectId: string;
  deploymentId: string;
  status: string;
}

export function DeploymentLogs({ projectId, deploymentId, status }: DeploymentLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLive =
    status === 'building' ||
    status === 'deploying' ||
    status === 'queued' ||
    status === 'verifying';

  useEffect(() => {
    if (!isLive) {
      fetch(`/api/projects/${projectId}/deployments/${deploymentId}/logs`)
        .then((response) => response.json())
        .then((data) => {
          setLogs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    const eventSource = new EventSource(
      `/api/projects/${projectId}/deployments/${deploymentId}/logs/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'logs') {
        setLogs(data.logs);
        setLoading(false);
      } else if (data.type === 'complete' || data.type === 'error') {
        eventSource.close();
        setLoading(false);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLoading(false);
    };

    setLoading(false);
    return () => eventSource.close();
  }, [projectId, deploymentId, isLive]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable ref for scroll anchoring
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="max-h-56 overflow-y-auto rounded-[20px] border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs">
      {loading ? (
        <span className="text-zinc-500">正在加载日志…</span>
      ) : logs.length === 0 ? (
        <span className="text-zinc-500">暂时没有日志</span>
      ) : (
        logs.map((entry) => (
          <div key={entry.id} className="mb-0.5 flex gap-2">
            <span className="shrink-0 text-zinc-600">
              {new Date(entry.createdAt).toLocaleTimeString()}
            </span>
            <span
              className={cn(
                entry.level === 'error'
                  ? 'text-red-400'
                  : entry.level === 'warn'
                    ? 'text-zinc-400'
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
