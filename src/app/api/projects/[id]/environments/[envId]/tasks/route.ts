import { createEnvironmentDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { dispatchPersistedAITask } from '@/lib/ai/tasks/reconciler';
import { handleAIAsyncTaskPost } from '@/lib/ai/tasks/route-helpers';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';

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
    enqueueTask: (task) => dispatchPersistedAITask({ taskId: task.id, kind: task.kind }),
    fallbackMessage: '环境分析任务创建失败',
  });
}
