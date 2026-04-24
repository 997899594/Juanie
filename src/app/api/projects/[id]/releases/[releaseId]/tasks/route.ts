import { createReleaseDeepAnalysisTask } from '@/lib/ai/tasks/generic-task-service';
import { getReleaseTaskCenterData } from '@/lib/ai/tasks/release-task-center';
import { handleAITaskCenterGet, handleAITaskCenterPost } from '@/lib/ai/tasks/route-helpers';
import { getProjectReleaseAccessOrThrow, requireSession } from '@/lib/api/access';
import { addAITaskJob } from '@/lib/queue';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  const { id: projectId, releaseId } = await params;
  const session = await requireSession();
  await getProjectReleaseAccessOrThrow(projectId, releaseId, session.user.id);

  return handleAITaskCenterGet({
    loadSnapshot: () =>
      getReleaseTaskCenterData({
        projectId,
        releaseId,
        actorUserId: session.user.id,
      }),
    fallbackMessage: '发布任务中心加载失败',
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  const { id: projectId, releaseId } = await params;
  const session = await requireSession();
  await getProjectReleaseAccessOrThrow(projectId, releaseId, session.user.id);

  return handleAITaskCenterPost({
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
