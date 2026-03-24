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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lineIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!projectId || !envId) return;
    setPods([]);
    setPodName('');
    fetch(`/api/projects/${projectId}/resources?type=pods&env=${envId}`)
      .then((r) => r.json())
      .then((data: Pod[] | { error: string }) => {
        if (!Array.isArray(data)) return;
        setPods(data);
        const running = data.find((p) => p.status.phase === 'Running');
        const first = running ?? data[0];
        if (first) setPodName(first.metadata.name);
      });
  }, [projectId, envId]);

  const startStream = useCallback(() => {
    if (!projectId || !envId || !podName) return;

    esRef.current?.close();
    setLines([]);
    setErrorMsg(null);
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
      };

      switch (data.type) {
        case 'connected':
          setStatus('streaming');
          break;
        case 'line':
          setLines((prev) => [...prev, { id: lineIdRef.current++, text: data.text ?? '' }]);
          break;
        case 'end':
          setStatus('ended');
          es.close();
          break;
        case 'error':
          setErrorMsg(data.message ?? 'Unknown error');
          setStatus('error');
          es.close();
          break;
      }
    };

    es.onerror = () => {
      setStatus('error');
      setErrorMsg('Connection lost');
      es.close();
    };
  }, [projectId, envId, podName, tail]);

  useEffect(() => {
    startStream();
    return () => {
      esRef.current?.close();
    };
  }, [startStream]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bottomRef is stable
  useEffect(() => {
    if (follow) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [lines, follow]);

  const statusLabel: Record<StreamStatus, string> = {
    idle: '空闲',
    connecting: '连接中',
    streaming: '实时',
    ended: '已结束',
    error: '错误',
  };

  const statusColor: Record<StreamStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
    idle: 'neutral',
    connecting: 'info',
    streaming: 'success',
    ended: 'warning',
    error: 'error',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="日志" description="实时 Pod 日志" />

      <div className="console-panel flex flex-wrap items-center gap-3 px-4 py-4">
        <Select value={envId} onValueChange={setEnvId}>
          <SelectTrigger className="h-10 w-40 rounded-xl text-xs">
            <SelectValue placeholder="环境" />
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
          <SelectTrigger className="h-10 w-72 rounded-xl text-xs font-mono">
            <SelectValue placeholder={pods.length === 0 ? '没有 Pod' : '选择 Pod'} />
          </SelectTrigger>
          <SelectContent>
            {pods.map((p) => (
              <SelectItem key={p.metadata.name} value={p.metadata.name}>
                {p.metadata.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tail} onValueChange={setTail}>
          <SelectTrigger className="h-10 w-32 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">最近 50 条</SelectItem>
            <SelectItem value="100">最近 100 条</SelectItem>
            <SelectItem value="200">最近 200 条</SelectItem>
            <SelectItem value="500">最近 500 条</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusIndicator
            status={statusColor[status]}
            pulse={status === 'streaming'}
            label={statusLabel[status]}
          />
          <Button
            variant="ghost"
            size="sm"
            className={cn('rounded-xl', follow && 'text-foreground')}
            onClick={() => setFollow((f) => !f)}
          >
            {follow ? '跟随中' : '跟随'}
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={startStream}>
            <RefreshCw className="h-3.5 w-3.5" />
            重连
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setLines([])}>
            <X className="h-3.5 w-3.5" />
            清空
          </Button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-950"
        style={{ height: 'calc(100vh - 240px)' }}
      >
        <div className="h-full overflow-y-auto p-4 font-mono text-xs leading-5">
          {status === 'idle' && !podName ? (
            <span className="text-zinc-500">先选择环境和 Pod。</span>
          ) : status === 'connecting' ? (
            <span className="animate-pulse text-zinc-500">正在连接 {podName}…</span>
          ) : errorMsg ? (
            <>
              {lines.map((line) => (
                <LogEntry key={line.id} text={line.text} />
              ))}
              <div className="mt-1 text-red-400">[错误] {errorMsg}</div>
            </>
          ) : lines.length === 0 ? (
            <span className="text-zinc-500">
              {status === 'ended' ? '日志流已结束。' : '等待日志输出…'}
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
        'select-text whitespace-pre-wrap break-all',
        isError ? 'text-red-400' : isWarn ? 'text-zinc-400' : 'text-zinc-200'
      )}
    >
      {text}
    </div>
  );
}
