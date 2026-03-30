'use client';

import { ExternalLink, RefreshCw, ScrollText, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import type { ObservabilityPageData } from '@/lib/observability/page-data';
import { cn } from '@/lib/utils';

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

interface LogsPageClientProps {
  projectId: string;
  projectName: string;
  initialData: ObservabilityPageData;
  initialEnvId?: string;
}

export function LogsPageClient({
  projectId,
  projectName,
  initialData,
  initialEnvId,
}: LogsPageClientProps) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [envId, setEnvId] = useState(
    initialData.environments.some((environment) => environment.id === initialEnvId)
      ? (initialEnvId ?? '')
      : (initialData.environments[0]?.id ?? '')
  );
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

  const selectedEnvironment = initialData.environments.find(
    (environment) => environment.id === envId
  );
  const selectedPod = pods.find((pod) => pod.metadata.name === podName) ?? null;
  const runningPodCount = pods.filter((pod) => pod.status.phase === 'Running').length;
  const readyPodCount = pods.filter((pod) =>
    pod.status.containerStatuses?.every((container) => container.ready)
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="运行日志" description={`${projectName} 的环境运行视图`} />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="console-panel px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            环境运行视图
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {selectedEnvironment?.name ?? '选择环境'}
            </h2>
            <Badge variant="outline">{initialData.governance.roleLabel}</Badge>
            {selectedEnvironment?.namespace ? (
              <Badge variant="secondary">{selectedEnvironment.namespace}</Badge>
            ) : null}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {initialData.governance.logs.summary}
            {selectedEnvironment
              ? ` 当前已识别 ${pods.length} 个 Pod，其中 ${runningPodCount} 个运行中，${readyPodCount} 个就绪。`
              : ' 先选择环境，再进入具体运行实例。'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" className="h-9 rounded-xl px-4">
              <Link href={`/projects/${projectId}/environments?env=${envId}`}>打开环境详情</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={`/projects/${projectId}/releases`}>
                查看发布
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="console-panel px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            当前诊断
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
              <div className="text-xs text-muted-foreground">环境</div>
              <div className="mt-1 text-sm font-medium">
                {selectedEnvironment?.name ?? '未选择'}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
              <div className="text-xs text-muted-foreground">当前 Pod</div>
              <div className="mt-1 truncate font-mono text-sm">
                {selectedPod?.metadata.name ?? '等待选择'}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
              <div className="text-xs text-muted-foreground">运行状态</div>
              <div className="mt-2">
                <StatusIndicator
                  status={statusColor[status]}
                  pulse={status === 'streaming'}
                  label={statusLabel[status]}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
              <div className="text-xs text-muted-foreground">日志策略</div>
              <div className="mt-1 text-sm font-medium">
                最近 {tail} 条 · {follow ? '自动跟随' : '手动浏览'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {pods.length > 0
                  ? `${runningPodCount} 个运行中 · ${readyPodCount} 个就绪`
                  : '等待识别运行实例'}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="console-panel px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="h-4 w-4" />
          诊断选择
        </div>
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
          <Select value={envId} onValueChange={setEnvId}>
            <SelectTrigger className="h-10 w-40 rounded-xl text-xs">
              <SelectValue placeholder="环境" />
            </SelectTrigger>
            <SelectContent>
              {initialData.environments.map((e) => (
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
            <Button
              variant="ghost"
              size="sm"
              className={cn('rounded-xl', follow && 'text-foreground')}
              onClick={() => setFollow((f) => !f)}
            >
              {follow ? '自动跟随中' : '开启跟随'}
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
      </div>

      <div className="h-[56vh] overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-950 md:h-[calc(100vh-320px)]">
        <div className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                实时输出
              </div>
              <div className="mt-1 font-mono text-sm text-zinc-200">
                {selectedPod?.metadata.name ?? '等待选择 Pod'}
              </div>
            </div>
            <StatusIndicator
              status={statusColor[status]}
              pulse={status === 'streaming'}
              label={statusLabel[status]}
            />
          </div>
        </div>
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

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="flex items-center gap-2 rounded-[24px] border border-border bg-background/95 p-2 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button
            variant="ghost"
            size="sm"
            className={cn('min-w-0 flex-1 rounded-xl', follow && 'text-foreground')}
            onClick={() => setFollow((f) => !f)}
          >
            {follow ? '跟随中' : '跟随'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 rounded-xl"
            onClick={startStream}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重连
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 rounded-xl"
            onClick={() => setLines([])}
          >
            <X className="h-3.5 w-3.5" />
            清空
          </Button>
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
