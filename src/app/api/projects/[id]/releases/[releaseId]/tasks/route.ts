import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createReleaseDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { getReleaseTaskCenterData } from '@/lib/ai/tasks/release-task-center';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { addAITaskJob } from '@/lib/queue';

const releaseTaskRequestSchema = z.object({
  kind: z.literal('deep_analysis'),
  question: z.string().trim().min(1).max(4000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id: projectId, releaseId } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(projectId, session.user.id);

    return NextResponse.json(
      await getReleaseTaskCenterData({
        projectId,
        releaseId,
        actorUserId: session.user.id,
      })
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id: projectId, releaseId } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(projectId, session.user.id);

    const body = await request.json().catch(() => null);
    const parsed = releaseTaskRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '任务请求格式不正确' }, { status: 400 });
    }

    const task = await createReleaseDeepAnalysisTask({
      projectId,
      releaseId,
      actorUserId: session.user.id,
      question: parsed.data.question,
    });
    await addAITaskJob(task.id, task.kind);

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      summary: '已加入任务中心，后台会继续完成分析。',
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
