'use client';

import { Check, Circle, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PlatformSignalBlock } from '@/components/ui/platform-signals';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { retryProjectInitialization } from '@/lib/projects/init-client-actions';
import type { getProjectInitPageData } from '@/lib/projects/init-service';

interface ProjectInitializingClientProps {
  projectId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getProjectInitPageData>>>;
}

type InitOverview = ProjectInitializingClientProps['initialData']['overview'];

function StepIcon({ status }: { status: InitOverview['steps'][number]['status'] }) {
  switch (status) {
    case 'completed':
      return <Check className="h-5 w-5 text-green-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-foreground" />;
    case 'failed':
      return <X className="h-5 w-5 text-destructive" />;
    case 'skipped':
      return <Circle className="h-5 w-5 text-muted-foreground" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/50" />;
  }
}

export function ProjectInitializingClient({
  projectId,
  initialData,
}: ProjectInitializingClientProps) {
  const router = useRouter();
  const [overview, setOverview] = useState(initialData.overview);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [streamToken, setStreamToken] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/projects/${projectId}/init/stream?token=${streamToken}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        setOverview(data.overview);
      } else if (data.type === 'complete') {
        setOverview(data.overview);
        eventSource.close();
        setTimeout(() => {
          router.push(`/projects/${projectId}`);
        }, 2000);
      } else if (data.type === 'error') {
        if (data.overview) {
          setOverview(data.overview);
        }
        setStreamError(data.message ?? '初始化失败');
        eventSource.close();
      }
    };

    eventSource.onerror = async () => {
      eventSource.close();

      try {
        const response = await fetch(`/api/projects/${projectId}/init/status`);
        if (!response.ok) {
          setStreamError('刷新初始化状态失败');
          return;
        }

        const data = await response.json();
        setOverview(data.overview);
      } catch {
        setStreamError('刷新初始化状态失败');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, router, streamToken]);

  const effectiveSummary = streamError ?? overview.primarySummary;
  const effectiveNextAction =
    streamError && overview.status !== 'active' ? '刷新页面或稍后重试' : overview.nextActionLabel;

  const handleRetry = async () => {
    setRetrying(true);
    setStreamError(null);

    const result = await retryProjectInitialization(projectId);

    if (!result.ok) {
      setStreamError(result.error);
      setRetrying(false);
      return;
    }

    setOverview(result.overview as InitOverview);
    setStreamToken((value) => value + 1);
    setRetrying(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={
          overview.status === 'active'
            ? '项目已就绪'
            : overview.status === 'failed'
              ? '初始化失败'
              : '项目初始化中'
        }
        description={effectiveSummary}
        actions={
          <StatusIndicator
            status={overview.statusTone}
            pulse={overview.status === 'initializing'}
            label={overview.statusLabel}
          />
        }
      />

      <PlatformSignalBlock
        chips={overview.platformSignals.chips}
        summary={streamError ?? overview.platformSignals.primarySummary ?? effectiveSummary}
        nextActionLabel={overview.platformSignals.nextActionLabel ?? effectiveNextAction}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">进度</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {overview.overallProgress}%
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">步骤</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {overview.completedSteps}/{overview.totalSteps}
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            后续动作
          </div>
          <div className="mt-3 text-sm font-semibold">{effectiveNextAction}</div>
        </div>
      </div>

      <div className="console-panel px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">进度</div>
          <div className="text-xs text-muted-foreground">{overview.overallProgress}%</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${overview.overallProgress}%` }}
          />
        </div>
      </div>

      <div className="console-panel console-list overflow-hidden px-0 py-0">
        {overview.steps.map((step) => (
          <div key={step.id} className="flex gap-4 px-5 py-4">
            <div className="mt-0.5 shrink-0">
              <StepIcon status={step.status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`text-sm font-semibold ${
                    step.status === 'running' ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
                {step.status === 'running' && step.progress > 0 && (
                  <span className="text-xs text-muted-foreground">{step.progress}%</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
              {step.message && !step.error && (
                <p className="mt-1 text-xs text-muted-foreground">{step.message}</p>
              )}
              {step.error && <p className="mt-1 text-xs text-destructive">{step.error}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {overview.status === 'active' && (
          <Link href={`/projects/${projectId}`}>
            <Button className="rounded-xl px-4">进入项目</Button>
          </Link>
        )}
        {overview.status === 'failed' && (
          <>
            {overview.recoveryAction?.kind === 'retry' ? (
              <Button className="rounded-xl px-4" onClick={handleRetry} disabled={retrying}>
                {retrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在重试
                  </>
                ) : (
                  overview.recoveryAction.label
                )}
              </Button>
            ) : overview.recoveryAction?.kind === 'link' && overview.recoveryAction.href ? (
              <Link href={overview.recoveryAction.href}>
                <Button className="rounded-xl px-4">{overview.recoveryAction.label}</Button>
              </Link>
            ) : overview.recoveryAction?.kind === 'wait' ? (
              <Button className="rounded-xl px-4" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                {overview.recoveryAction.label}
              </Button>
            ) : null}
            <Link href="/projects/new">
              <Button variant="outline" className="rounded-xl px-4">
                返回创建页
              </Button>
            </Link>
          </>
        )}
        {overview.status === 'initializing' && (
          <div className="text-sm text-muted-foreground">通常需要几分钟，请稍候。</div>
        )}
      </div>
    </div>
  );
}
