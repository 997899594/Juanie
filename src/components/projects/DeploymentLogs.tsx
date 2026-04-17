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
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamToken, setStreamToken] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<LogEntry[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const streamIdentity = `${projectId}:${deploymentId}`;
  const isLive =
    status === 'building' ||
    status === 'deploying' ||
    status === 'queued' ||
    status === 'verifying';

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    if (!streamIdentity) {
      return;
    }

    setLogs([]);
    setLoading(true);
    setStreamError(null);
    setStreamToken(0);
  }, [streamIdentity]);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    if (!isLive) {
      clearReconnectTimer();
      setStreamError(null);
      setLoading(true);
      fetch(`/api/projects/${projectId}/deployments/${deploymentId}/logs`)
        .then((response) => response.json())
        .then((data) => {
          setLogs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    let closed = false;
    setLoading(logsRef.current.length === 0);

    const eventSource = new EventSource(
      `/api/projects/${projectId}/deployments/${deploymentId}/logs/stream?token=${streamToken}`
    );

    const scheduleReconnect = () => {
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        setStreamToken((value) => value + 1);
      }, 1500);
    };

    eventSource.onopen = () => {
      clearReconnectTimer();
      setStreamError(null);
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'logs') {
        setLogs((current) => (data.mode === 'append' ? [...current, ...data.logs] : data.logs));
        setLoading(false);
        setStreamError(null);
      } else if (data.type === 'complete' || data.type === 'error') {
        clearReconnectTimer();
        eventSource.close();
        setLoading(false);
        if (data.type === 'error') {
          setStreamError(data.message ?? '实时日志连接失败');
        } else {
          setStreamError(null);
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (closed) {
        return;
      }

      setLoading(false);
      setStreamError('实时连接中断，正在重试…');
      scheduleReconnect();
    };

    return () => {
      closed = true;
      clearReconnectTimer();
      eventSource.close();
    };
  }, [projectId, deploymentId, isLive, streamToken]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable ref for scroll anchoring
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="max-h-56 overflow-y-auto rounded-[20px] bg-zinc-950 p-4 font-mono text-xs shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_10px_26px_rgba(15,23,42,0.18)]">
      {streamError && <div className="mb-2 text-[11px] text-amber-300">{streamError}</div>}
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
