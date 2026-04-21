import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';

export const projectInitDispatchErrorCode = 'init_enqueue_failed';

export async function markProjectInitDispatchFailed(input: {
  projectId: string;
  errorMessage: string;
}): Promise<void> {
  const firstStep = await db.query.projectInitSteps.findFirst({
    where: eq(projectInitSteps.projectId, input.projectId),
    orderBy: [asc(projectInitSteps.createdAt)],
  });

  if (firstStep) {
    await db
      .update(projectInitSteps)
      .set({
        status: 'failed',
        message: '初始化任务未成功写入队列，请稍后重试',
        progress: 0,
        errorCode: projectInitDispatchErrorCode,
        error: input.errorMessage,
        startedAt: null,
        completedAt: null,
      })
      .where(eq(projectInitSteps.id, firstStep.id));
  }

  await db
    .update(projects)
    .set({
      status: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(projects.id, input.projectId));
}

export async function deleteCreatedProject(projectId: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, projectId));
}
