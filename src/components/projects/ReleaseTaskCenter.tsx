'use client';

import { CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AITaskDetailDialog } from '@/components/projects/AITaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReleaseTaskCenterSnapshot } from '@/lib/ai/tasks/release-task-center';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface ReleaseTaskItem {
  id: string;
  kind: 'migration_approval' | 'migration_external' | 'migration_failed' | 'ai_analysis';
  title: string;
  summary: string;
  statusLabel: string;
  actionLabel: string | null;
  inputSummary?: string | null;
  detail?: string | null;
  createdAtLabel?: string | null;
  completedAtLabel?: string | null;
  provider?: string | null;
  model?: string | null;
  migrationRunId?: string | null;
  migrationRunStatus?: string | null;
  approvalToken?: string | null;
}

function getTaskTone(kind: ReleaseTaskItem['kind']): 'warning' | 'secondary' {
  if (kind === 'migration_approval' || kind === 'migration_external' || kind === 'ai_analysis') {
    return 'warning';
  }

  return 'secondary';
}

export function ReleaseTaskCenter(input: {
  projectId: string;
  releaseId: string;
  canManageActions: boolean;
  disabledSummary?: string | null;
  initialSnapshot?: ReleaseTaskCenterSnapshot | null;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ReleaseTaskCenterSnapshot | null>(
    input.initialSnapshot ?? null
  );
  const [loading, setLoading] = useState(!input.initialSnapshot);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ReleaseTaskItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${input.projectId}/releases/${input.releaseId}/tasks`
      );
      const data = (await response.json().catch(() => null)) as
        | ReleaseTaskCenterSnapshot
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : '任务中心加载失败'
        );
      }

      setSnapshot(data as ReleaseTaskCenterSnapshot);
    } catch {
      setSnapshot({
        summary: '任务中心暂不可用',
        actionableCount: 0,
        tasks: [],
      });
    } finally {
      setLoading(false);
    }
  }, [input.projectId, input.releaseId]);

  useEffect(() => {
    if (!input.initialSnapshot) {
      load();
    }
  }, [input.initialSnapshot, load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };

    window.addEventListener('juanie:refresh-ai-task-center', refresh);
    return () => {
      window.removeEventListener('juanie:refresh-ai-task-center', refresh);
    };
  }, [load]);

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
    <section className="rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
            事项
          </div>
          <div className="mt-2 text-sm text-[rgba(15,23,42,0.48)]">
            {loading ? '整理中…' : (snapshot?.summary ?? '当前发布没有事项')}
          </div>
          {!input.canManageActions && input.disabledSummary ? (
            <div className="mt-2 text-xs text-[rgba(15,23,42,0.42)]">{input.disabledSummary}</div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
          onClick={load}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {snapshot?.tasks.length ? (
        <div className="mt-5 space-y-2.5">
          {snapshot.tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-foreground">{task.title}</div>
                  <Badge
                    variant={getTaskTone(task.kind) === 'warning' ? 'warning' : 'secondary'}
                    className="rounded-full border-0 px-2.5 py-1 shadow-none"
                  >
                    {task.statusLabel}
                  </Badge>
                </div>
                <div className="mt-1.5 text-sm text-[rgba(15,23,42,0.54)]">{task.summary}</div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {task.kind === 'ai_analysis' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full border-0 bg-[rgba(255,255,255,0.76)] px-3.5 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-white"
                    onClick={() => setSelectedTask(task)}
                  >
                    <Sparkles className="h-4 w-4" />
                    结果
                  </Button>
                ) : null}

                {task.migrationRunId && task.actionLabel ? (
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
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="mt-5 rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-4 text-sm text-[rgba(15,23,42,0.48)]">
          暂无事项
        </div>
      ) : null}

      <AITaskDetailDialog
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
          }
        }}
        task={
          selectedTask
            ? {
                title: selectedTask.title,
                statusLabel: selectedTask.statusLabel,
                summary: selectedTask.summary,
                inputSummary: selectedTask.inputSummary,
                detail: selectedTask.detail,
                createdAtLabel: selectedTask.createdAtLabel,
                completedAtLabel: selectedTask.completedAtLabel,
                provider: selectedTask.provider,
                model: selectedTask.model,
                scopeLabel: 'release-task',
              }
            : null
        }
      />
    </section>
  );
}
