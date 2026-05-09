import { createReleaseDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { handleAIAsyncTaskPost } from '@/lib/ai/tasks/route-helpers';
import { getProjectReleaseAccessOrThrow, requireSession } from '@/lib/api/access';
import { addAITaskJob } from '@/lib/queue';

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
    enqueueTask: (task) => addAITaskJob(task.id, task.kind),
    fallbackMessage: '发布分析任务创建失败',
  });
}
