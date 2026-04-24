'use client';

import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AITaskCenterSection } from '@/components/projects/AITaskCenterSection';
import { Button } from '@/components/ui/button';
import { useAITaskCenter } from '@/hooks/useAITaskCenter';
import type { EnvironmentTaskCenterSnapshot } from '@/lib/ai/tasks/environment-task-center';
import type { AITaskCenterItem } from '@/lib/ai/tasks/view-model';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface EnvironmentTaskItem extends AITaskCenterItem {
  id: string;
  href?: string | null;
  migrationRunId?: string | null;
  migrationRunStatus?: string | null;
  approvalToken?: string | null;
}

export function EnvironmentTaskCenter(input: {
  projectId: string;
  environmentId: string;
  initialSnapshot?: EnvironmentTaskCenterSnapshot | null;
}) {
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const { snapshot, loading, load } = useAITaskCenter<EnvironmentTaskItem>({
    endpoint: `/api/projects/${input.projectId}/environments/${input.environmentId}/tasks`,
    initialSnapshot: input.initialSnapshot ?? null,
  });

  const handleMigrationAction = async (task: EnvironmentTaskItem) => {
    if (!task.migrationRunId || !task.migrationRunStatus) {
      return;
    }

    const action =
      task.migrationRunStatus === 'awaiting_approval'
        ? 'approve'
        : task.migrationRunStatus === 'awaiting_external_completion'
          ? 'mark_external_complete'
          : task.migrationRunStatus === 'failed'
            ? 'retry'
            : null;

    if (!action) {
      return;
    }

    setPendingTaskId(task.id);
    try {
      await executeMigrationRunAction({
        projectId: input.projectId,
        runId: task.migrationRunId,
        action,
        approvalToken: task.approvalToken ?? null,
      });
      await load();
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <AITaskCenterSection
      loading={loading}
      summary={snapshot?.summary ?? null}
      emptySummary="当前环境没有事项"
      scopeLabel="environment-task"
      tasks={snapshot?.tasks ?? []}
      onRefresh={load}
      renderActions={(task) => (
        <>
          {task.migrationRunId && task.actionLabel ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-full border-0 bg-[rgba(255,255,255,0.76)] px-3.5 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-white"
              onClick={() => handleMigrationAction(task)}
              disabled={pendingTaskId === task.id}
            >
              {pendingTaskId === task.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {task.actionLabel}
            </Button>
          ) : null}

          {task.href ? (
            <Button
              asChild
              variant="ghost"
              className="h-8 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
            >
              <Link href={task.href}>
                打开
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </>
      )}
    />
  );
}
