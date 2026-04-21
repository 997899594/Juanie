import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';
import { markProjectInitDispatchFailed } from '@/lib/projects/init-dispatch';
import { getProjectInitPageData, getProjectInitRetryContext } from '@/lib/projects/init-service';
import { addProjectInitJob } from '@/lib/queue';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const retryContext = await getProjectInitRetryContext(id, session.user.id);

    if (!retryContext) {
      return NextResponse.json({ error: '当前初始化状态不可重试' }, { status: 400 });
    }

    if (!retryContext.retryAllowed) {
      return NextResponse.json(
        {
          error: retryContext.retryBlockedReason ?? '当前错误不支持直接重试',
          code: 'retry_blocked',
        },
        { status: 400 }
      );
    }

    const steps = await db.query.projectInitSteps.findMany({
      where: eq(projectInitSteps.projectId, id),
      orderBy: (step, { asc }) => [asc(step.createdAt)],
    });

    const stepsToReset = steps.slice(retryContext.failedStepOrder).map((step) => step.id);

    if (stepsToReset.length === 0) {
      return NextResponse.json({ error: '当前初始化状态不可重试' }, { status: 400 });
    }

    await Promise.all([
      db
        .update(projectInitSteps)
        .set({
          status: 'pending',
          message: null,
          progress: 0,
          errorCode: null,
          error: null,
          startedAt: null,
          completedAt: null,
        })
        .where(inArray(projectInitSteps.id, stepsToReset)),
      db
        .update(projects)
        .set({
          status: 'initializing',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id)),
    ]);

    try {
      await addProjectInitJob(id, retryContext.mode, retryContext.template);
    } catch (error) {
      const queueErrorMessage =
        error instanceof Error ? error.message : '初始化任务创建失败，请稍后重试';

      await markProjectInitDispatchFailed({
        projectId: id,
        errorMessage: queueErrorMessage,
      });

      return NextResponse.json(
        {
          error: '重新执行初始化失败，初始化任务未成功写入队列',
          code: 'project_init_queue_failed',
          details: queueErrorMessage,
        },
        { status: 503 }
      );
    }

    const pageData = await getProjectInitPageData(id, session.user.id);
    if (!pageData) {
      return NextResponse.json({ error: '项目不存在或无权限访问' }, { status: 404 });
    }

    return NextResponse.json({
      overview: pageData.overview,
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
