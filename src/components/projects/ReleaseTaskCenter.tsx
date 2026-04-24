'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AITaskCenterSection } from '@/components/projects/AITaskCenterSection';
import { Button } from '@/components/ui/button';
import { useAITaskCenter } from '@/hooks/useAITaskCenter';
import type { ReleaseTaskCenterSnapshot } from '@/lib/ai/tasks/release-task-center';
import type { AITaskCenterItem } from '@/lib/ai/tasks/view-model';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface ReleaseTaskItem extends AITaskCenterItem {
  id: string;
  migrationRunId?: string | null;
  migrationRunStatus?: string | null;
  approvalToken?: string | null;
}

export function ReleaseTaskCenter(input: {
  projectId: string;
  releaseId: string;
  canManageActions: boolean;
  disabledSummary?: string | null;
  initialSnapshot?: ReleaseTaskCenterSnapshot | null;
}) {
  const router = useRouter();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const { snapshot, loading, load } = useAITaskCenter<ReleaseTaskItem>({
    endpoint: `/api/projects/${input.projectId}/releases/${input.releaseId}/tasks`,
    initialSnapshot: input.initialSnapshot ?? null,
  });

  const handleMigrationAction = async (task: ReleaseTaskItem) => {
    if (!task.migrationRunId || !task.migrationRunStatus || !input.canManageActions) {
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
      router.refresh();
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <AITaskCenterSection
      loading={loading}
      summary={snapshot?.summary ?? null}
      emptySummary="当前发布没有事项"
      disabledSummary={!input.canManageActions ? input.disabledSummary : null}
      scopeLabel="release-task"
      tasks={snapshot?.tasks ?? []}
      onRefresh={load}
      renderActions={(task) =>
        task.migrationRunId && task.actionLabel ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full border-0 bg-[rgba(255,255,255,0.76)] px-3.5 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-white"
            onClick={() => handleMigrationAction(task)}
            disabled={pendingTaskId === task.id || !input.canManageActions}
          >
            {pendingTaskId === task.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {task.actionLabel}
          </Button>
        ) : null
      }
    />
  );
}
