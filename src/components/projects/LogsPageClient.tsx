'use client';

import { RefreshCw, ScrollText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
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
import { formatPlatformDateTime, formatPlatformRelativeTime } from '@/lib/time/format';
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

const shellClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';

const subCardClassName =
  'rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

interface LogsPageClientProps {
  projectId: string;
  projectName: string;
  initialData: ObservabilityPageData;
  initialEnvId?: string;
}

export function LogsPageClient({ projectId, initialData, initialEnvId }: LogsPageClientProps) {
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
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [lastLineAt, setLastLineAt] = useState<string | null>(null);

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
    const now = new Date().toISOString();
    setSessionStartedAt(now);
    setLastLineAt(null);

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
          setLastLineAt(new Date().toISOString());
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
  const sessionStartedLabel = formatPlatformDateTime(sessionStartedAt) ?? null;
  const lastLineLabel = formatPlatformRelativeTime(lastLineAt) ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="日志" description={selectedEnvironment?.name} />
      <EnvironmentSectionNav projectId={projectId} environmentId={envId || null} />

      <div className={shellClassName}>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          日志范围
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={envId} onValueChange={setEnvId}>
              <SelectTrigger className="h-11 rounded-[16px] border-0 bg-white/75 text-sm shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]">
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
              <SelectTrigger className="h-11 rounded-[16px] border-0 bg-white/75 font-mono text-sm shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]">
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
              <SelectTrigger className="h-11 rounded-[16px] border-0 bg-white/75 text-sm shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">最近 50 条</SelectItem>
                <SelectItem value="100">最近 100 条</SelectItem>
                <SelectItem value="200">最近 200 条</SelectItem>
                <SelectItem value="500">最近 500 条</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button
              variant="ghost"
              size="sm"
              className={cn('rounded-full', follow && 'text-foreground')}
              onClick={() => setFollow((f) => !f)}
            >
              {follow ? '自动跟随中' : '开启跟随'}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={startStream}>
              <RefreshCw className="h-3.5 w-3.5" />
              重连
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setLines([])}>
              <X className="h-3.5 w-3.5" />
              清空
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              环境
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {selectedEnvironment?.name ?? '未选择'}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pod</div>
            <div className="mt-2 truncate font-mono text-sm text-foreground">
              {selectedPod?.metadata.name ?? '等待选择'}
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              状态
            </div>
            <div className="mt-2">
              <StatusIndicator
                status={statusColor[status]}
                pulse={status === 'streaming'}
                label={statusLabel[status]}
              />
            </div>
          </div>
          <div className={subCardClassName}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              最新输出
            </div>
            <div className="mt-2 text-sm text-foreground">{lastLineLabel ?? '等待输出'}</div>
          </div>
        </div>
      </div>

      <div className="h-[56vh] overflow-hidden rounded-[24px] bg-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_24px_48px_rgba(15,23,42,0.22)] md:h-[calc(100vh-340px)]">
        <div className="bg-zinc-950/90 px-4 py-3 shadow-[inset_0_-1px_0_rgba(63,63,70,0.75)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                实时输出
              </div>
              <div className="mt-1 font-mono text-sm text-zinc-200">
                {selectedPod?.metadata.name ?? '等待选择 Pod'}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {[
                  selectedEnvironment?.name ?? null,
                  pods.length > 0
                    ? `${runningPodCount} 运行中 / ${readyPodCount} 就绪`
                    : '等待识别',
                  sessionStartedLabel ? `会话开始 ${sessionStartedLabel}` : null,
                  lastLineLabel ? `最后更新 ${lastLineLabel}` : null,
                  lines.length > 0 ? `${lines.length} 行` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '等待日志会话建立'}
              </div>
            </div>
            <StatusIndicator
              status={statusColor[status]}
              pulse={status === 'streaming'}
              label={statusLabel[status]}
            />
          </div>
        </div>
        <div className="h-full overflow-y-auto px-4 py-4 font-mono text-xs leading-5 sm:px-5">
          {status === 'idle' && !podName ? (
            <span className="text-zinc-500">选择环境和 Pod</span>
          ) : status === 'connecting' ? (
            <span className="animate-pulse text-zinc-500">正在连接 {podName}…</span>
          ) : errorMsg ? (
            <>
              {lines.map((line) => (
                <LogEntry key={line.id} text={line.text} />
              ))}
              <div className="mt-2 rounded-[18px] bg-red-500/10 px-3 py-2 text-red-300 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
                {errorMsg}
              </div>
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
        <div className="flex items-center gap-2 rounded-2xl bg-background/95 p-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button
            variant="ghost"
            size="sm"
            className={cn('min-w-0 flex-1 rounded-full', follow && 'text-foreground')}
            onClick={() => setFollow((f) => !f)}
          >
            {follow ? '跟随中' : '跟随'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 rounded-full"
            onClick={startStream}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重连
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 rounded-full"
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
