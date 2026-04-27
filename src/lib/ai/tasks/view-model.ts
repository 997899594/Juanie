import type { AITaskCenterSnapshot } from '@/lib/ai/tasks/catalog';
import type { GenericAITaskRecord } from '@/lib/ai/tasks/generic-task-service';
import { formatPlatformTimeContext } from '@/lib/time/format';

export type AITaskCenterItemKind =
  | 'migration_approval'
  | 'migration_external'
  | 'migration_failed'
  | 'deployment_failed'
  | 'ai_analysis'
  | 'schema_repair'
  | 'preview_cleanup_blocked';

export interface AITaskCenterItem {
  id: string;
  kind: AITaskCenterItemKind;
  title: string;
  summary: string;
  statusLabel: string;
  actionLabel: string | null;
  href?: string | null;
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

export function buildAITaskCenterSnapshot<TTask extends AITaskCenterItem>(input: {
  tasks: TTask[];
  subjectLabel: string;
}): AITaskCenterSnapshot<TTask> {
  return {
    summary:
      input.tasks.length > 0
        ? `当前${input.subjectLabel}有 ${input.tasks.length} 个待处理事项`
        : `当前${input.subjectLabel}没有待处理事项`,
    actionableCount: input.tasks.length,
    tasks: input.tasks,
  };
}

export function formatAITaskStatusLabel(status: GenericAITaskRecord['status']): string {
  if (status === 'succeeded') {
    return '已完成';
  }

  if (status === 'failed') {
    return '失败';
  }

  if (status === 'running') {
    return '进行中';
  }

  return '排队中';
}

export function toAIAnalysisTaskItem(input: {
  task: GenericAITaskRecord;
  href?: string | null;
}): AITaskCenterItem {
  return {
    id: `ai-${input.task.id}`,
    kind: 'ai_analysis',
    title: `AI 深度分析 · ${input.task.title}`,
    summary: input.task.resultSummary ?? input.task.errorMessage ?? input.task.inputSummary,
    statusLabel: formatAITaskStatusLabel(input.task.status),
    actionLabel: null,
    href: input.href ?? null,
    inputSummary: input.task.inputSummary,
    detail: input.task.resultSummary ?? input.task.errorMessage,
    createdAtLabel: formatPlatformTimeContext(input.task.createdAt),
    completedAtLabel: formatPlatformTimeContext(input.task.completedAt),
    provider: input.task.provider,
    model: input.task.model,
  };
}
