import { NextResponse } from 'next/server';
import { toAIRouteErrorResponse } from '@/lib/ai/http/route-response';
import { AI_TASK_ENQUEUED_SUMMARY, aiTaskRequestSchema } from '@/lib/ai/tasks/catalog';
import type { GenericAITaskRecord } from '@/lib/ai/tasks/generic-task-service';

export async function handleAIAsyncTaskPost(input: {
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
