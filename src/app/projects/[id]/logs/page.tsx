'use client';

import { RefreshCw, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  namespace: string | null;
}

interface Pod {
  metadata: {
    name: string;
    namespace: string;
  };
  status: {
    phase: string;
    containerStatuses?: Array<{ name: string; ready: boolean }>;
  };
}

interface LogLine {
  id: number;
  text: string;
}

type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'ended' | 'error';

export default function LogsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [envId, setEnvId] = useState('');
  const [podName, setPodName] = useState('');
  const [tail, setTail] = useState('100');
  const [follow, setFollow] = useState(true);

  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lineIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load environments
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/environments`)
      .then((r) => r.json())
      .then((data: Environment[]) => {
        const envs = Array.isArray(data) ? data : [];
        setEnvironments(envs);
        if (envs[0]) setEnvId(envs[0].id);
      });
  }, [projectId]);

  // Load pods when env changes
  useEffect(() => {
    if (!projectId || !envId) return;
    setPods([]);
    setPodName('');
    fetch(`/api/projects/${projectId}/resources?type=pods&env=${envId}`)
      .then((r) => r.json())
      .then((data: Pod[] | { error: string }) => {
        if (!Array.isArray(data)) return;
        setPods(data);
        // Auto-select first running pod, otherwise first pod
        const running = data.find((p) => p.status.phase === 'Running');
        const first = running ?? data[0];
        if (first) setPodName(first.metadata.name);
      });
  }, [projectId, envId]);

  // Start (or restart) the SSE stream
  const startStream = useCallback(() => {
    if (!projectId || !envId || !podName) return;

    esRef.current?.close();
    setLines([]);
    setErrorMsg(null);
    setConnected(false);
    setStatus('connecting');

    const url = new URL(`/api/projects/${projectId}/logs/stream`, window.location.origin);
    url.searchParams.set('envId', envId);
    url.searchParams.set('pod', podName);
    url.searchParams.set('tail', tail);

    const es = new EventSource(url.toString());
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as {
        type: string;
        text?: string;
        message?: string;
        pod?: string;
      };

      switch (data.type) {
        case 'connected':
          setConnected(true);
          setStatus('streaming');
          break;
        case 'line':
          setLines((prev) => [...prev, { id: lineIdRef.current++, text: data.text ?? '' }]);
          break;
        case 'end':
          setConnected(false);
          setStatus('ended');
          es.close();
          break;
        case 'error':
          setErrorMsg(data.message ?? 'Unknown error');
          setConnected(false);
          setStatus('error');
          es.close();
          break;
      }
    };

    es.onerror = () => {
      setConnected(false);
      setStatus('error');
      setErrorMsg('Connection lost');
      es.close();
    };
  }, [projectId, envId, podName, tail]);

  // Re-connect when params change
  useEffect(() => {
    startStream();
    return () => {
      esRef.current?.close();
    };
  }, [startStream]);

  // Auto-scroll to bottom when following
  // biome-ignore lint/correctness/useExhaustiveDependencies: bottomRef is a stable ref
  useEffect(() => {
    if (follow) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [lines, follow]);

  const statusLabel: Record<StreamStatus, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    streaming: 'Live',
    ended: 'Ended',
    error: 'Error',
  };

  const statusColor: Record<StreamStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> =
    {
      idle: 'neutral',
      connecting: 'info',
      streaming: 'success',
      ended: 'warning',
      error: 'error',
    };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Logs" description="Real-time pod logs via Kubernetes log stream" />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={envId} onValueChange={setEnvId}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={podName} onValueChange={setPodName} disabled={pods.length === 0}>
          <SelectTrigger className="h-8 w-60 text-xs font-mono">
            <SelectValue placeholder={pods.length === 0 ? 'No pods' : 'Select pod'} />
          </SelectTrigger>
          <SelectContent>
            {pods.map((p) => (
              <SelectItem key={p.metadata.name} value={p.metadata.name}>
                <span className="font-mono text-xs">{p.metadata.name}</span>
                {p.status.phase !== 'Running' && (
                  <span className="ml-2 text-muted-foreground">{p.status.phase}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tail} onValueChange={setTail}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Last 50</SelectItem>
            <SelectItem value="100">Last 100</SelectItem>
            <SelectItem value="200">Last 200</SelectItem>
            <SelectItem value="500">Last 500</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <StatusIndicator
            status={statusColor[status]}
            pulse={status === 'streaming'}
            label={statusLabel[status]}
          />

          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 text-xs', follow && 'text-primary')}
            onClick={() => setFollow((f) => !f)}
            title="Toggle auto-scroll to newest line"
          >
            {follow ? 'Following ↓' : 'Follow'}
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={startStream}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reconnect
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setLines([])}
            title="Clear log output"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div
        className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden"
        style={{ height: 'calc(100vh - 220px)' }}
      >
        <div className="h-full overflow-y-auto p-3 font-mono text-xs leading-5">
          {status === 'idle' && !podName ? (
            <span className="text-zinc-500">Select an environment and pod to start streaming.</span>
          ) : status === 'connecting' ? (
            <span className="text-zinc-500 animate-pulse">Connecting to {podName}…</span>
          ) : errorMsg ? (
            <>
              {lines.map((line) => (
                <LogEntry key={line.id} text={line.text} />
              ))}
              <div className="text-red-400 mt-1">[error] {errorMsg}</div>
            </>
          ) : lines.length === 0 ? (
            <span className="text-zinc-500">
              {status === 'ended' ? 'Stream ended — no output.' : 'Waiting for log output…'}
            </span>
          ) : (
            lines.map((line) => <LogEntry key={line.id} text={line.text} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function LogEntry({ text }: { text: string }) {
  // Colour stderr/error lines red, warn lines yellow, everything else default
  const lower = text.toLowerCase();
  const isError =
    lower.includes('error') ||
    lower.includes('fatal') ||
    lower.includes('exception') ||
    lower.includes('panic');
  const isWarn = !isError && (lower.includes('warn') || lower.includes('warning'));

  return (
    <div
      className={cn(
        'whitespace-pre-wrap break-all select-text',
        isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-zinc-200'
      )}
    >
      {text}
    </div>
  );
}
