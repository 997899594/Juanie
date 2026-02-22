'use client';

import { Check, Circle, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  validate_repository: 'Validating Repository',
  create_repository: 'Creating Repository',
  push_template: 'Pushing Template Files',
  setup_namespace: 'Setting Up Namespace',
  deploy_services: 'Deploying Services',
  provision_databases: 'Provisioning Databases',
  configure_dns: 'Configuring DNS',
};

function StepIcon({ status }: { status: InitStepStatus }) {
  switch (status) {
    case 'completed':
      return <Check className="h-5 w-5 text-green-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 'active'
            ? 'Project Ready!'
            : status === 'failed'
              ? 'Initialization Failed'
              : 'Initializing Project'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {status === 'active'
            ? 'Your project is ready to use'
            : status === 'failed'
              ? error || 'Something went wrong'
              : 'Setting up your project...'}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{overallProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        step.status === 'running' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {STEP_LABELS[step.step] || step.step}
                    </span>
                    {step.status === 'running' && step.progress > 0 && (
                      <span className="text-xs text-muted-foreground">{step.progress}%</span>
                    )}
                  </div>
                  {step.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.message}</p>
                  )}
                  {step.error && <p className="text-xs text-destructive mt-0.5">{step.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        {status === 'active' && (
          <Link href={`/projects/${projectId}`}>
            <Button>Go to Project</Button>
          </Link>
        )}
        {status === 'failed' && (
          <Link href="/projects/new">
            <Button>Try Again</Button>
          </Link>
        )}
        {status === 'initializing' && (
          <p className="text-sm text-muted-foreground">This may take a few minutes...</p>
        )}
      </div>
    </div>
  );
}
