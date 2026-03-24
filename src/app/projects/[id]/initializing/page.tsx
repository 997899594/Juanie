'use client';

import { Check, Circle, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { InitStepStatus } from '@/lib/db/schema';

interface InitStep {
  id: string;
  step: string;
  status: InitStepStatus;
  message: string | null;
  progress: number;
  error: string | null;
}

const STEP_LABELS: Record<string, string> = {
  validate_repository: '验证仓库',
  create_repository: '创建仓库',
  push_template: '推送模板文件',
  setup_namespace: '创建命名空间',
  deploy_services: '部署服务',
  provision_databases: '创建数据库',
  configure_dns: '配置域名',
};

function StepIcon({ status }: { status: InitStepStatus }) {
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

export default function InitializingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [steps, setSteps] = useState<InitStep[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [status, setStatus] = useState<'initializing' | 'active' | 'failed'>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/projects/${projectId}/init/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        setSteps(data.steps);
        setOverallProgress(data.overallProgress);
      } else if (data.type === 'complete') {
        setStatus('active');
        setOverallProgress(100);
        eventSource.close();
        setTimeout(() => {
          router.push(`/projects/${projectId}`);
        }, 2000);
      } else if (data.type === 'error') {
        setStatus('failed');
        setError(data.message);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      fetchInitialData();
    };

    async function fetchInitialData() {
      try {
        const res = await fetch(`/api/projects/${projectId}/init/status`);
        if (res.ok) {
          const data = await res.json();
          setSteps(data.steps);
          setOverallProgress(data.overallProgress);
          setStatus(data.status);
          if (data.status === 'active') {
            setTimeout(() => {
              router.push(`/projects/${projectId}`);
            }, 2000);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    }

    fetchInitialData();

    return () => {
      eventSource.close();
    };
  }, [projectId, router]);

  const statusLabel = status === 'active' ? '已就绪' : status === 'failed' ? '失败' : '初始化中';

  const statusTone = status === 'active' ? 'success' : status === 'failed' ? 'error' : 'info';
  const completedSteps = steps.filter((step) => step.status === 'completed').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={
          status === 'active' ? '项目已就绪' : status === 'failed' ? '初始化失败' : '项目初始化中'
        }
        description={status === 'failed' ? error || '初始化过程中出现问题' : undefined}
        actions={
          <StatusIndicator
            status={statusTone}
            pulse={status === 'initializing'}
            label={statusLabel}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">进度</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{overallProgress}%</div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">步骤</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {completedSteps}/{steps.length || 0}
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            后续动作
          </div>
          <div className="mt-3 text-sm font-semibold">
            {status === 'active' ? '正在打开项目…' : status === 'failed' ? '等待处理' : '等待中'}
          </div>
        </div>
      </div>

      <div className="console-panel px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">进度</div>
          <div className="text-xs text-muted-foreground">{overallProgress}%</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      <div className="console-panel overflow-hidden px-0 py-0">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex gap-4 border-b border-border/70 px-5 py-4 last:border-b-0"
          >
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
                  {STEP_LABELS[step.step] || step.step}
                </span>
                {step.status === 'running' && step.progress > 0 && (
                  <span className="text-xs text-muted-foreground">{step.progress}%</span>
                )}
              </div>
              {step.message && <p className="mt-1 text-xs text-muted-foreground">{step.message}</p>}
              {step.error && <p className="mt-1 text-xs text-destructive">{step.error}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {status === 'active' && (
          <Link href={`/projects/${projectId}`}>
            <Button className="rounded-xl px-4">进入项目</Button>
          </Link>
        )}
        {status === 'failed' && (
          <Link href="/projects/new">
            <Button className="rounded-xl px-4">重新开始</Button>
          </Link>
        )}
        {status === 'initializing' && (
          <div className="text-sm text-muted-foreground">通常需要几分钟，请稍候。</div>
        )}
      </div>
    </div>
  );
}
