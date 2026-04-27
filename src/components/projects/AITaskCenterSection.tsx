'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { AITaskDetailDialog } from '@/components/projects/AITaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AITaskCenterItem } from '@/lib/ai/tasks/view-model';

function getTaskTone(kind: AITaskCenterItem['kind']): 'warning' | 'secondary' {
  if (
    kind === 'migration_approval' ||
    kind === 'migration_external' ||
    kind === 'deployment_failed' ||
    kind === 'schema_repair' ||
    kind === 'ai_analysis'
  ) {
    return 'warning';
  }

  return 'secondary';
}

export function AITaskCenterSection<TTask extends AITaskCenterItem>(input: {
  loading: boolean;
  summary: string | null;
  emptySummary: string;
  disabledSummary?: string | null;
  scopeLabel: string;
  tasks: TTask[];
  onRefresh: () => void;
  renderActions?: (task: TTask) => React.ReactNode;
}) {
  const [selectedTask, setSelectedTask] = useState<TTask | null>(null);

  return (
    <section className="rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
            事项
          </div>
          <div className="mt-2 text-sm text-[rgba(15,23,42,0.48)]">
            {input.loading ? '整理中…' : (input.summary ?? input.emptySummary)}
          </div>
          {input.disabledSummary ? (
            <div className="mt-2 text-xs text-[rgba(15,23,42,0.42)]">{input.disabledSummary}</div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
          onClick={input.onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {input.tasks.length ? (
        <div className="mt-5 space-y-2.5">
          {input.tasks.map((task) => (
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

                {input.renderActions?.(task)}
              </div>
            </div>
          ))}
        </div>
      ) : !input.loading ? (
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
                scopeLabel: input.scopeLabel,
              }
            : null
        }
      />
    </section>
  );
}
