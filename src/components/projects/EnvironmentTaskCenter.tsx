'use client';

import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AITaskDetailDialog } from '@/components/projects/AITaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EnvironmentTaskCenterSnapshot } from '@/lib/ai/tasks/environment-task-center';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface EnvironmentTaskItem {
  id: string;
  kind:
    | 'migration_approval'
    | 'migration_external'
    | 'migration_failed'
    | 'ai_analysis'
    | 'schema_repair'
    | 'preview_cleanup_blocked';
  title: string;
  summary: string;
  statusLabel: string;
  actionLabel: string | null;
  href: string | null;
  inputSummary?: string | null;
  detail?: string | null;
  createdAtLabel?: string | null;
  completedAtLabel?: string | null;
  migrationRunId?: string | null;
  migrationRunStatus?: string | null;
  approvalToken?: string | null;
}

function getTaskTone(kind: EnvironmentTaskItem['kind']): 'warning' | 'success' | 'secondary' {
  if (
    kind === 'migration_approval' ||
    kind === 'migration_external' ||
    kind === 'schema_repair' ||
    kind === 'ai_analysis'
  ) {
    return 'warning';
  }

  if (kind === 'migration_failed' || kind === 'preview_cleanup_blocked') {
    return 'secondary';
  }

  return 'success';
}

export function EnvironmentTaskCenter(input: {
  projectId: string;
  environmentId: string;
  initialSnapshot?: EnvironmentTaskCenterSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<EnvironmentTaskCenterSnapshot | null>(
    input.initialSnapshot ?? null
  );
  const [loading, setLoading] = useState(!input.initialSnapshot);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<EnvironmentTaskItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${input.projectId}/environments/${input.environmentId}/tasks`
      );
      const data = (await response.json().catch(() => null)) as
        | EnvironmentTaskCenterSnapshot
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : '任务中心加载失败'
        );
      }

      setSnapshot(data as EnvironmentTaskCenterSnapshot);
    } catch {
      setSnapshot({
        summary: '任务中心暂不可用',
        actionableCount: 0,
        tasks: [],
      });
    } finally {
      setLoading(false);
    }
  }, [input.environmentId, input.projectId]);

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
    <section className="rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
            待处理事项
          </div>
          <div className="mt-2 text-sm text-[rgba(15,23,42,0.48)]">
            {loading ? '正在整理待处理事项…' : (snapshot?.summary ?? '当前环境没有待处理事项')}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-full bg-[rgba(15,23,42,0.045)] px-4 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-[rgba(15,23,42,0.08)]"
          onClick={load}
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      </div>

      {snapshot?.tasks.length ? (
        <div className="mt-5 space-y-3">
          {snapshot.tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-4 rounded-[18px] bg-[rgba(15,23,42,0.035)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-foreground">{task.title}</div>
                  <Badge
                    variant={getTaskTone(task.kind) === 'warning' ? 'warning' : 'secondary'}
                    className="rounded-full border-0 px-3 py-1 shadow-none"
                  >
                    {task.statusLabel}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">{task.summary}</div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {task.kind === 'ai_analysis' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full border-0 bg-[rgba(255,255,255,0.72)] px-4 text-[rgba(15,23,42,0.72)] shadow-none hover:bg-white"
                    onClick={() => setSelectedTask(task)}
                  >
                    <Sparkles className="h-4 w-4" />
                    查看结果
                  </Button>
                ) : null}

                {task.migrationRunId && task.actionLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full border-0 bg-[rgba(255,255,255,0.72)] px-4 text-[rgba(15,23,42,0.72)] shadow-none hover:bg-white"
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
                    className="h-9 rounded-full bg-[rgba(15,23,42,0.045)] px-4 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-[rgba(15,23,42,0.08)]"
                  >
                    <Link href={task.href}>
                      进入处理
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="mt-5 rounded-[18px] bg-[rgba(15,23,42,0.035)] px-4 py-4 text-sm text-[rgba(15,23,42,0.48)]">
          没有需要你现在处理的事项。
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
              }
            : null
        }
      />
    </section>
  );
}
