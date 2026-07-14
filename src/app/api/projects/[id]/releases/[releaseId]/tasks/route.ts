import { createReleaseDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { dispatchPersistedAITask } from '@/lib/ai/tasks/reconciler';
import { handleAIAsyncTaskPost } from '@/lib/ai/tasks/route-helpers';
import { getProjectReleaseAccessOrThrow, requireSession } from '@/lib/api/access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  const { id: projectId, releaseId } = await params;
  const session = await requireSession();
  await getProjectReleaseAccessOrThrow(projectId, releaseId, session.user.id);

  return handleAIAsyncTaskPost({
    request,
    createTask: (question) =>
      createReleaseDeepAnalysisTask({
        projectId,
        releaseId,
        actorUserId: session.user.id,
        question,
      }),
    enqueueTask: (task) => dispatchPersistedAITask({ taskId: task.id, kind: task.kind }),
    fallbackMessage: '发布分析任务创建失败',
  });
}
