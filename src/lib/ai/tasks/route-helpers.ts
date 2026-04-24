import { NextResponse } from 'next/server';
import { toAIRouteErrorResponse } from '@/lib/ai/http/route-response';
import {
  AI_TASK_ENQUEUED_SUMMARY,
  type AITaskCenterSnapshot,
  aiTaskRequestSchema,
} from '@/lib/ai/tasks/catalog';
import type { GenericAITaskRecord } from '@/lib/ai/tasks/generic-task-service';

export async function handleAITaskCenterGet(input: {
  loadSnapshot: () => Promise<AITaskCenterSnapshot>;
  fallbackMessage?: string;
}): Promise<NextResponse> {
  try {
    return NextResponse.json(await input.loadSnapshot());
  } catch (error) {
    return toAIRouteErrorResponse(error, input.fallbackMessage ?? '任务中心加载失败');
  }
}

export async function handleAITaskCenterPost(input: {
  request: Request;
  createTask: (question: string) => Promise<GenericAITaskRecord>;
  enqueueTask: (task: GenericAITaskRecord) => Promise<unknown>;
  fallbackMessage?: string;
}): Promise<NextResponse> {
  try {
    const body = await input.request.json().catch(() => null);
    const parsed = aiTaskRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '任务请求格式不正确' }, { status: 400 });
    }

    const task = await input.createTask(parsed.data.question);
    await input.enqueueTask(task);

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      summary: AI_TASK_ENQUEUED_SUMMARY,
    });
  } catch (error) {
    return toAIRouteErrorResponse(error, input.fallbackMessage ?? '任务创建失败');
  }
}
