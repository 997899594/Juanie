import { createEnvironmentDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { handleAIAsyncTaskPost } from '@/lib/ai/tasks/route-helpers';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';
import { addAITaskJob } from '@/lib/queue';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const { id: projectId, envId } = await params;
  const session = await requireSession();
  await getProjectEnvironmentAccessOrThrow(projectId, envId, session.user.id);

  return handleAIAsyncTaskPost({
    request,
    createTask: (question) =>
      createEnvironmentDeepAnalysisTask({
        projectId,
        environmentId: envId,
        actorUserId: session.user.id,
        question,
      }),
    enqueueTask: (task) => addAITaskJob(task.id, task.kind),
    fallbackMessage: '环境分析任务创建失败',
  });
}
